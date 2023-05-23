
API_KEY = '1234'
SERVER_API_KEY = '123456' # ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=6))

import json, os, sys, time, random, _thread
from serv import gateway

def home(request_, response_, route_args_):
	with open('web/index.html') as fp:
		content = fp.read()
	return response_.write_response_OK_(content_type_='text/html', content_=content, charset_='UTF-8')

rpc_registry = {}
def handle_rpc(data):
	func_name = data['func_name']
	argv = data['argv']
	kwargs = data['kwargs']
	api_key = data['api_key']
	if not (func_name in rpc_registry or func_name in gateway.rpc_registry):
		return {'error': f'没有该服务: {func_name}'}
	if func_name in rpc_registry:
		if len(rpc_registry[func_name])==2:
			api_key_gt, func = rpc_registry[func_name]
			rpc_registry[func_name] = (api_key_gt, func, _thread.allocate_lock())
		api_key_gt, func, lock = rpc_registry[func_name]
		if api_key_gt is not None and api_key_gt!=api_key:
			return {'error': 'api_key' if api_key is None else f'错误的 API_KEY: {api_key}'}
		else:
			try:
				lock.acquire()
				res = func(*argv, **kwargs)
			finally:
				lock.release()
			return res
	else:
		return gateway.gateway_handle_rpc(data)

def ajax_(request_, response_, route_args_):
	global rpc_registry
	params_ = request_.params_
	assert 'data' in params_, '服务请求参数中缺少 data'
	data = json.loads(params_['data'])
	try:
		res = handle_rpc(data)
	except Exception as ex:
		from serv.lib.http_ import http_handle_ex_
		res = {'error': http_handle_ex_(ex)}
	json_ = json.dumps(res)
	return response_.write_response_JSON_OK_(json_)

def gateway_(request_, response_, route_args_):
	params_ = request_.params_
	assert 'data' in params_, '服务请求参数中缺少 data'
	data = json.loads(params_['data'])
	gateway.gateway_thread(data, request_.addr_[0], request_.socket_file_, SERVER_API_KEY)

http_ = None
def start_server_(port_, max_threads_, esp32_html_=None):
	from .lib.http_ import Http_
	global http_
	assert http_ is None
	http_ = Http_(ip_='0.0.0.0', port_=port_, web_path_='web', max_threads_=max_threads_)
	if esp32_html_ is not None:
		http_.add_route_('/', esp32_html_, client_addr_='192.168.4.')
	http_.add_route_('/ajax', ajax_, 'POST')
	http_.add_route_('/gateway', gateway_, 'POST')
	# http_.add_route_('/audio', audio_, 'POST')
	http_.add_route_('/', home, 'GET')
	# print(f'Python MDL 服务器运行在端口 {port_}')
	http_.start_()

def stop_server_():
	http_.stop_()

# from . import css
# css.download_mdl_themes()

def audio_to_text_api(b64):
	import base64
	b64 = base64.b64decode(b64)
	audio_path = 'record.ogg'
	with open(audio_path, 'wb') as fp:
		fp.write(b64)
	text_data = whisper_model.transcribe(audio_path)
	text = text_data['text']
	os.unlink(audio_path)
	return ['', text]

# audio_queue = []
# def audio_(request_, response_, route_args_):
# 	params_ = request_.params_
# 	text = []
# 	try:
# 		for param_ in params_:
# 			if not param_.endswith('.ogg'):
# 				continue
# 			data_ = params_[param_]
# 			with open(param_, 'wb') as fp:
# 				fp.write(data_['file'])
# 			if whisper_model is not None:
# 				text_data = whisper_model.transcribe(param_)
# 				text.append(text_data['text'])
# 				os.unlink(param_)
# 		return response_.write_response_JSON_OK_(json_ = json.dumps(['', text]))
# 	except Exception as ex:
# 		return response_.write_response_JSON_OK_(json_ = json.dumps([str(ex), text]))

server_stopped = False
chat_queue_waiting = []
chat_queue_done = []
def _chat_queue_waiting_update():
	for i,chat_ in enumerate(chat_queue_waiting):
		chat_['queue_size'] = len(chat_queue_waiting)
		chat_['queue_index'] = i
		chat_['done'] = False
def _chat_queue_find(queue, chat_id):
	for i, chat_ in enumerate(queue):
		if chat_['chat_id'] == chat_id:
			return i, chat_
	return -1, None
def chat_thread():
	from .model import chat_stream
	print('聊天服务器已启动')
	global server_stopped
	while not server_stopped:
		if len(chat_queue_waiting)==0:
			time.sleep(.1)
			continue
		chat_ = chat_queue_waiting[0]
		_chat_queue_waiting_update()
		try:
			for _ in chat_stream(model, tokenizer, model_path, 'cuda', chat_):
				if server_stopped or 'stream_stopped' in chat_:
					break
		except Exception as ex:
			chat_['exception'] = str(ex)
			import traceback
			traceback.print_exc()
			del traceback
		chat_['done'] = True
		chat_queue_done.append(chat_)
		chat_queue_waiting.pop(0)
	print('聊天服务器已关闭')
def chat_api(chat_id, query, params):
	stream_stopped = False
	if chat_id==-1:
		chat_id = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=16))
		params['chat_id'] = chat_id
		params['query'] = query
		chat_queue_waiting.append(params)
		_chat_queue_waiting_update()
	elif query is True:
		stream_stopped = True
	i, chat_ = _chat_queue_find(chat_queue_done, chat_id)
	if i!=-1:
		chat_queue_done.pop(i)
		return chat_
	i, chat_ = _chat_queue_find(chat_queue_waiting, chat_id)
	if stream_stopped and chat_ is not None:
		chat_['stream_stopped'] = True
	return chat_

whisper_model = None
tokenizer = None
model = None
model_path = None
try:
	from .model import load_model
	print('启动 whisper')
	import whisper
	whisper_model = whisper.load_model('medium', download_root='model/whisper')
	whisper_model.to('cuda')
	model_settings = {'model/chatglm-6b':1, 'model/vicuna-13b':2, 'model/vicuna-7b':1}
	for model_path, num_gpus in model_settings.items():
		if os.path.isdir(model_path):
			print('启动', model_path)
			model, tokenizer = load_model(model_path, 'cuda', num_gpus)
			break
	_thread.start_new_thread(chat_thread, ())
	rpc_registry['audio_to_text'] = (API_KEY, audio_to_text_api)
	rpc_registry['chat'] = (API_KEY, chat_api)
except Exception as ex:
	print(str(ex))
print(f'本地服务API_KEY: {API_KEY}')

def stop_server():
	stop_server_()
	return '服务器正在关闭'
rpc_registry['stop_server'] = (SERVER_API_KEY, stop_server)

port = int(sys.argv[1]) if len(sys.argv)>=2 else 8000
gateway_addr = sys.argv[2] if len(sys.argv)>=3 else None
if gateway_addr is not None:
	gateway.start_worker(gateway_addr, SERVER_API_KEY, 'audio_to_text', handle_rpc)
	gateway.start_worker(gateway_addr, SERVER_API_KEY, 'chat', handle_rpc)
	# # test
	# def audio_to_text_api2(b64):
	# 	return ['', 'Audio-to-Text is unavailable.']
	# def chat_api2(chat_id, query, params):
	# 	chat_ = {}
	# 	chat_['chat_id'] = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=16))
	# 	chat_['query'] = query
	# 	chat_['queue_index'] = 0
	# 	chat_['done'] = True
	# 	chat_['stream_stopped'] = True
	# 	chat_['messages'] = [['User', query], ['Assistant', 'LLM is unavailable.']]
	# 	return chat_
	# rpc_registry['audio_to_text'] = (API_KEY, audio_to_text_api2)
	# rpc_registry['chat'] = (API_KEY, chat_api2)	

print(f'网页服务器端口: {port}, 服务器API_KEY: {SERVER_API_KEY}')
start_server_(port, 100)
print('网页服务器已关闭')
server_stopped = True
if gateway_addr is not None:
	gateway.stop_worker(gateway_addr, 'audio_to_text')
	gateway.stop_worker(gateway_addr, 'chat')

