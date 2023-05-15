
import torch, gc
from transformers import AutoTokenizer, AutoModel, AutoModelForCausalLM, LlamaForCausalLM


class SeparatorStyle:
	"""Separator styles."""
	ADD_COLON_SINGLE = 1
	ADD_COLON_TWO = 2
	NO_COLON_SINGLE = 3

class Conversation:
	"""A class that keeps all conversation history."""
	# The name of this template
	name = None
	# System prompts
	system = None
	# Two roles
	roles = None
	# All messages
	messages = None
	# Offset of few shot examples
	offset = None
	# Separators
	sep_style = None
	sep = None
	sep2 = None
	# Stop criteria (the default one is EOS token)
	stop_str  = None
	# Stops generation if meeting any token in this list
	stop_token_ids = None

	def __init__(self, name, system, roles, messages, offset, sep_style, sep, sep2=None, stop_str=None):
		self.name = name
		self.system = system
		self.roles = roles
		self.messages = messages
		self.offset = offset
		self.sep_style = sep_style
		self.sep = sep
		self.sep2 = sep2
		self.stop_str = stop_str

	def get_prompt(self) -> str:
		"""Get the prompt for generation."""
		if self.sep_style == SeparatorStyle.ADD_COLON_SINGLE:
			ret = self.system + self.sep
			for role, message in self.messages:
				if message:
					ret += role + ": " + message + self.sep
				else:
					ret += role + ":"
			return ret
		elif self.sep_style == SeparatorStyle.ADD_COLON_TWO:
			seps = [self.sep, self.sep2]
			ret = self.system + seps[0]
			for i, (role, message) in enumerate(self.messages):
				if message:
					ret += role + ": " + message + seps[i % 2]
				else:
					ret += role + ":"
			return ret
		elif self.sep_style == SeparatorStyle.NO_COLON_SINGLE:
			ret = self.system
			for role, message in self.messages:
				if message:
					ret += role + message + self.sep
				else:
					ret += role
			return ret
		else:
			raise ValueError(f"Invalid style: {self.sep_style}")


def get_conv_template(name: str):
	if name=='chatglm':
		return Conversation(
			name="chatglm",
			system="A chat between a curious human and an artificial intelligence assistant. "
			"The assistant gives helpful, detailed, and polite answers to the human's questions.",
			roles=("Human", "Assistant"),
			messages=(),
			offset=0,
			sep_style=SeparatorStyle.ADD_COLON_SINGLE,
			sep="\n### ",
			stop_str="###",
		)
	if name=='vicuna':
		return Conversation(
			name="vicuna",
			system="A chat between a curious user and an artificial intelligence assistant. "
			"The assistant gives helpful, detailed, and polite answers to the user's questions.",
			roles=("USER", "ASSISTANT"),
			messages=(),
			offset=0,
			sep_style=SeparatorStyle.ADD_COLON_TWO,
			sep=" ",
			sep2="</s>",
		)	
	return None


def prepare_logits_processor(temperature, repetition_penalty, top_p, top_k):
	from transformers.generation.logits_process import (
		LogitsProcessorList,
		RepetitionPenaltyLogitsProcessor,
		TemperatureLogitsWarper,
		TopKLogitsWarper,
		TopPLogitsWarper,
	)
	processor_list = LogitsProcessorList()
	# TemperatureLogitsWarper doesn't accept 0.0, 1.0 makes it a no-op so we skip two cases.
	if temperature >= 1e-5 and temperature != 1.0:
		processor_list.append(TemperatureLogitsWarper(temperature))
	if repetition_penalty > 1.0:
		processor_list.append(RepetitionPenaltyLogitsProcessor(repetition_penalty))
	if 1e-8 <= top_p < 1.0:
		processor_list.append(TopPLogitsWarper(top_p))
	if top_k > 0:
		processor_list.append(TopKLogitsWarper(top_k))
	return processor_list


class VicunaAdapter:
	"Model adapater for vicuna-v1.1"
	def match(self, model_path: str):
		return "vicuna" in model_path
	def load_model(self, model_path: str, from_pretrained_kwargs: dict):
		tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=False)
		model = AutoModelForCausalLM.from_pretrained(
			model_path,
			low_cpu_mem_usage=True,
			**from_pretrained_kwargs,
		)
		self.raise_warning_for_old_weights(model)
		return model, tokenizer
	def get_default_conv_template(self, model_path: str):
		return get_conv_template("vicuna")
	def raise_warning_for_old_weights(self, model):
		if isinstance(model, LlamaForCausalLM) and model.model.vocab_size > 32000:
			warnings.warn(
				"\nYou are probably using the old Vicuna-v0 model, "
				"which will generate unexpected results with the "
				"current fastchat.\nYou can try one of the following methods:\n"
				"1. Upgrade your weights to the new Vicuna-v1.1: https://github.com/lm-sys/FastChat#vicuna-weights.\n"
				"2. Use the old conversation template by `python3 -m fastchat.serve.cli --model-path /path/to/vicuna-v0 --conv-template conv_one_shot`\n"
				"3. Downgrade fschat to fschat==0.1.10 (Not recommonded).\n"
			)
	@torch.inference_mode()
	def generate_stream(self, model, tokenizer, conv, chat_):
		conv.messages = chat_['messages']
		prompt = conv.get_prompt()
		len_prompt = len(prompt)
		temperature = float(chat_.get("temperature", 1.0))
		repetition_penalty = float(chat_.get("repetition_penalty", 1.0))
		top_p = float(chat_.get("top_p", 1.0))
		top_k = int(chat_.get("top_k", -1))  # -1 2048 disable
		context_len = int(chat_.get("context_len", 256))
		stream_interval = int(chat_.get("stream_interval", 2))
		max_new_tokens = int(chat_.get("max_new_tokens", 256))
		stop_str = chat_.get("stop", None)
		stop_token_ids = chat_.get("stop_token_ids", None) or []
		stop_token_ids.append(tokenizer.eos_token_id)
		logits_processor = prepare_logits_processor(temperature, repetition_penalty, top_p, top_k)
		input_ids = tokenizer(prompt).input_ids
		input_echo_len = len(input_ids)
		output_ids = list(input_ids)
		max_src_len = context_len - max_new_tokens - 8
		input_ids = input_ids[-max_src_len:]
		device = chat_['device']
		for i in range(max_new_tokens):
			if i == 0:
				out = model(torch.as_tensor([input_ids], device=device), use_cache=True)
				logits = out.logits
				past_key_values = out.past_key_values
			else:
				out = model(
					input_ids=torch.as_tensor([[token]], device=device),
					use_cache=True,
					past_key_values=past_key_values,
				)
				logits = out.logits
				past_key_values = out.past_key_values
			if logits_processor:
				if repetition_penalty > 1.0:
					tmp_output_ids = torch.as_tensor([output_ids], device=logits.device)
				else:
					tmp_output_ids = None
				last_token_logits = logits_processor(tmp_output_ids, logits[:, -1, :])[0]
			else:
				last_token_logits = logits[0, -1, :]
			if temperature < 1e-5 or top_p < 1e-8:  # greedy
				token = int(torch.argmax(last_token_logits))
			else:
				probs = torch.softmax(last_token_logits, dim=-1)
				token = int(torch.multinomial(probs, num_samples=1))
			output_ids.append(token)
			if token in stop_token_ids:
				stopped = True
			else:
				stopped = False
			if i % stream_interval == 0 or i == max_new_tokens - 1 or stopped:
				tmp_output_ids = output_ids[input_echo_len:]
				output = tokenizer.decode(
					tmp_output_ids,
					skip_special_tokens=True,
					spaces_between_special_tokens=False,
				)
				if stop_str:
					pos = output.rfind(stop_str, 0)
					if pos != -1:
						output = output[:pos]
						stopped = True
				chat_['messages'][-1][1] = output
				yield output
			if stopped:
				break
		del past_key_values, out
		gc.collect()
		torch.cuda.empty_cache()


class ChatGLMAdapter:
	"""The model adapter for THUDM/chatglm-6b"""
	def match(self, model_path: str):
		return "chatglm" in model_path
	def load_model(self, model_path: str, from_pretrained_kwargs: dict):
		tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
		model = AutoModel.from_pretrained(model_path, trust_remote_code=True, **from_pretrained_kwargs)
		model = model.half()
		return model, tokenizer
	def get_default_conv_template(self, model_path: str):
		return get_conv_template("chatglm")
	def generate_stream(self, model, tokenizer, conv, chat_):
		"""Generate text using model's chat api"""
		messages = chat_["messages"]
		max_length = int(chat_.get("max_length", 2048))
		temperature = float(chat_.get("temperature", 1.0))
		temperature, do_sample = (temperature,True) if temperature>1e-5 else (1e-5,False)
		top_p = float(chat_.get("top_p", 1.0))
		repetition_penalty = float(chat_.get("repetition_penalty", 1.0))
		params = {
			"max_length": max_length,
			"do_sample": do_sample,
			"top_p": top_p,
			"repetition_penalty": repetition_penalty,
			"temperature": temperature,
		}
		hist = []
		for i in range(0, len(messages) - 2, 2):
			hist.append((messages[i][1], messages[i + 1][1]))
		query = messages[-2][1]
		for response, _ in model.stream_chat(tokenizer, query, hist, **params):
			messages[-1][1] = response
			yield response

def get_model_adapter(model_path: str):
	"""Get a model adapter for a model_path."""
	model_adapters = []
	model_adapters.append(ChatGLMAdapter())
	model_adapters.append(VicunaAdapter())
	for adapter in model_adapters:
		if adapter.match(model_path):
			return adapter
	raise ValueError(f"No valid model adapter for {model_path}")


def get_gpu_memory(max_gpus=None):
	"""Get available memory for each GPU."""
	gpu_memory = []
	num_gpus = (
		torch.cuda.device_count()
		if max_gpus is None
		else min(max_gpus, torch.cuda.device_count())
	)

	for gpu_id in range(num_gpus):
		with torch.cuda.device(gpu_id):
			device = torch.cuda.current_device()
			gpu_properties = torch.cuda.get_device_properties(device)
			total_memory = gpu_properties.total_memory / (1024**3)
			allocated_memory = torch.cuda.memory_allocated() / (1024**3)
			available_memory = total_memory - allocated_memory
			gpu_memory.append(available_memory)
	return gpu_memory


def load_model(model_path, device, num_gpus, max_gpu_memory = None):
	if device == "cpu":
		kwargs = {"torch_dtype": torch.float32}
	elif device == "cuda":
		kwargs = {"torch_dtype": torch.float16}
		if num_gpus != 1:
			kwargs["device_map"] = "auto"
			if max_gpu_memory is None:
				kwargs[
					"device_map"
				] = "sequential"  # This is important for not the same VRAM sizes
				available_gpu_memory = get_gpu_memory(num_gpus)
				kwargs["max_memory"] = {
					i: str(int(available_gpu_memory[i] * 0.85)) + "GiB"
					for i in range(num_gpus)
				}
			else:
				kwargs["max_memory"] = {i: max_gpu_memory for i in range(num_gpus)}
	else:
		raise ValueError(f"Invalid device: {device}")
	# Load model
	adapter = get_model_adapter(model_path)
	model, tokenizer = adapter.load_model(model_path, kwargs)
	if (device == "cuda" and num_gpus == 1) or device == "mps":
		model.to(device)
	return model, tokenizer


def chat_stream(model, tokenizer, model_path, device, chat_):
	adapter = get_model_adapter(model_path)
	conv = adapter.get_default_conv_template(model_path)
	if 'messages' not in chat_:
		chat_['messages'] = []
	chat_['messages'].append([conv.roles[0], chat_['query']])
	chat_['messages'].append([conv.roles[1], None])
	chat_['device'] = device
	return adapter.generate_stream(model, tokenizer, conv, chat_)

