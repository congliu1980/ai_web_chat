
def send(data, callback):
	ajax = javascript.XMLHttpRequest.new()
	done = False
	def onerror(e):
		nonlocal done
		statusText = ajax.statusText.data()
		if statusText=='':
			statusText = '未能从服务器获取信息'
		if not done:
			done = True
			callback({'error': statusText})
	def onreadystatechange(e):
		nonlocal done
		if (ajax.readyState.data() == 4): # XMLHttpRequest.DONE
			status = ajax.status.data()
			if ((status>=200) and (status<300)) or (status==304):
				if not done:
					done = True
					callback(ajax.response.data())
			else:
				onerror(None)
	ajax.onreadystatechange = onreadystatechange
	ajax.onerror = onerror
	ajax.open('POST', '/ajax', True)
	ajax.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
	ajax.responseType = 'json'
	post_data = {'data':javascript.JSON.stringify(data)}
	ajax.send(javascript.URLSearchParams.new(post_data))

class _RPC_service:
	def __init__(self):
		pass
	def __getattr__(self, func_name):
		return _RPC_func(func_name)

api_key_dialog = None
def prompt_for_api_key(func_name):
	global api_key_dialog
	import mdl
	Textfield = mdl.Textfield	
	Dialog = mdl.Dialog	
	Container = mdl.Container	
	if api_key_dialog is None:
		api_key_dialog = Dialog(actions_full_width=True, actions=['确定','取消'])
		api_key_dialog.render(javascript.document.body)
	api_key = ''
	def set_api_key(v):
		nonlocal api_key
		api_key = v
	api_key_textfield = Textfield(label='API_KEY', floating_label=True, onchange=set_api_key)
	act = api_key_dialog.show(content=Container(api_key_textfield), title=f'请求调用API: {func_name}')
	if act=='确定':
		return api_key
	return None
		
_api_key = {}
class _RPC_func:
	def __init__(self, func_name):
		self.func_name = func_name
	def __call__(self, *argv, **kwargs):
		import time
		done = False
		res = None
		error = None
		def callback(data):
			nonlocal res
			nonlocal done
			nonlocal error
			if isinstance(data, dict) and ('error' in data):
				error = data['error']
				done = True
				return
			res = data
			done = True
		global _api_key
		api_key = _api_key.get(self.func_name, None)
		data = {'func_name':self.func_name, 'argv':argv, 'kwargs':kwargs, 'api_key':api_key}
		send(data, callback)
		while not done:
			time.sleep(.1)
		if error is not None:
			if error=='api_key':
				api_key = prompt_for_api_key(self.func_name)
				if api_key is None:
					raise RuntimeError(f'请求调用API {self.func_name} 失败')
				_api_key[self.func_name] = api_key
				return self.__call__(*argv, **kwargs)
			else:
				raise RuntimeError(error) 
		return res

rpc = _RPC_service()
