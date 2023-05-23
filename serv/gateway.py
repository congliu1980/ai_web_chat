
import json, time, _thread, sys

def _time():
	return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def _ajax_write(socket_file, path, data):
	data = json.dumps(data).replace('+','%2b').replace(' ','+')
	data = f'data={data}'.encode()
	msg = f'POST /{path} HTTP/1.1\r\n'+\
			'Content-Type: application/x-www-form-urlencoded\r\n'+\
			f'Content-Length: {len(data)}\r\n\r\n'
	socket_file.write(msg.encode())
	socket_file.write(data)
	socket_file.flush()

def _ajax_read(socket_file):
	content_length = None
	while True:
		line = socket_file.readline().strip()
		kv = line.decode().split(':')
		if len(kv)==2:
			if kv[0].strip().lower()=='content-length':
				content_length = int(kv[1].strip())
		if line is None or len(line)==0:
			break
	data = None
	if content_length is not None:
		data = socket_file.read(content_length)
		try:
			from serv.lib.http_ import unquote_plus_
			data = data.decode()
			assert data.startswith('data=')
			data = unquote_plus_(data[5:])
			data = json.loads(data)
		except:
			data = {'error': data}
	return data

def send_ajax_rpc_request(server_addr, func_name, api_key, *argv, **kwargs):
	import socket
	client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	if server_addr.startswith('http://'):
		server_addr = server_addr[7:]
	server_addr, path = (server_addr.split('/', 1)) if '/' in server_addr else (server_addr, '')
	server_addr, port = (server_addr.split(':', 1)) if ':' in server_addr else (server_addr, 80)
	port = int(port)
	remote_ip = socket.gethostbyname(server_addr)
	client_socket.connect((remote_ip , port))
	socket_file = client_socket.makefile('rwb')
	data = {'func_name':func_name, 'api_key':api_key, 'argv':argv, 'kwargs':kwargs}
	_ajax_write(socket_file, 'ajax', data)
	data = _ajax_read(socket_file)
	socket_file.close()
	client_socket.close()
	return data

# gateway server

rpc_registry = {}
def gateway_handle_rpc(data):
	func_name = data['func_name']
	_, queue = rpc_registry[func_name]
	task = [data, False]
	queue.append(task)
	while not task[1]:
		time.sleep(.1)
	return task[0]

def gateway_thread(data, client_addr, server_socket_file, server_api_key, heartbeat_interval=10):
	func_name = data['func_name']
	api_key = data['api_key']
	if api_key!=server_api_key:
		_ajax_write(server_socket_file, '', {'error':'Wrong api_key'})
		return
	if func_name in rpc_registry and rpc_registry[func_name][0]!=client_addr:
		_ajax_write(server_socket_file, '', {'error': f'"{func_name}" is token by client "{rpc_registry[func_name][0]}"'})
		return
	_ajax_write(server_socket_file, '', {'reply':'OK'})
	print(f'Gateway worker accepted: ("{client_addr}","{func_name}") {_time()}')
	queue = []
	rpc_registry[func_name] = (client_addr, queue)
	heartbeat_time = time.time()
	heartbeat_data = {'func_name':'--heartbeat--'}
	try:
		while True:
			if len(queue)==0:
				if queue is not rpc_registry[func_name][1]:
					print(f'Gateway worker updated: ("{client_addr}","{func_name}") {_time()}')
					break
				time.sleep(.1)
				if time.time() - heartbeat_time > heartbeat_interval:
					heartbeat_time = time.time()
					_ajax_write(server_socket_file, '', heartbeat_data)
					# print('_', end='')
					# sys.stdout.flush()
					_ajax_read(server_socket_file)
					# print('.', end='')
					# sys.stdout.flush()
				continue
			task = queue[0]
			data = task[0]
			_ajax_write(server_socket_file, '', data)
			data = _ajax_read(server_socket_file)
			task[:] = [data, True]
			queue.pop(0)
	except:
		for task in queue:
			task[:] = [{'error':'Gateway worker exception'}, True]
		print(f'Gateway worker exception: ("{client_addr}","{func_name}") {_time()}')
		if queue is rpc_registry[func_name][1]:
			del rpc_registry[func_name]


# gateway worker
_worker_status = {}

def worker_thread_(gateway_addr, gateway_api_key, func_name, handle_rpc):
	import socket
	_worker_status[(gateway_addr, func_name)] = True
	while _worker_status[(gateway_addr, func_name)]:
		try:
			worker_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
			server_addr = gateway_addr
			if server_addr.startswith('http://'):
				server_addr = server_addr[7:]
			server_addr, path = (server_addr.split('/', 1)) if '/' in server_addr else (server_addr, '')
			server_addr, port = (server_addr.split(':', 1)) if ':' in server_addr else (server_addr, 80)
			port = int(port)
			remote_ip = socket.gethostbyname(server_addr)
			worker_socket.settimeout(30)
			worker_socket.connect((remote_ip , port))
			worker_socket_file = worker_socket.makefile('rwb')
			try:
				data = {'func_name':func_name, 'api_key':gateway_api_key}
				_ajax_write(worker_socket_file, 'gateway', data)
				data = _ajax_read(worker_socket_file)
				if 'error' in data:
					print(f'Fail to start gateway worker: ("{gateway_addr}","{func_name})" {_time()}')
					print(data['error'])
					break
				print(f'Gateway worker started: ("{gateway_addr}","{func_name}") {_time()}')
				while _worker_status[(gateway_addr, func_name)]:
					data = _ajax_read(worker_socket_file)
					if data is None:
						continue
					if 'func_name' in data and data['func_name']=='--heartbeat--':
						data = {}
					else:
						try:
							data = handle_rpc(data)
						except Exception as ex:
							from serv.lib.http_ import http_handle_ex_
							data = {'error': http_handle_ex_(ex)}
					_ajax_write(worker_socket_file, '', data)
			finally:
				worker_socket_file.close()
				worker_socket.close()
		except KeyboardInterrupt:
			break
		except TimeoutError:
			time.sleep(1)
		except ConnectionRefusedError:
			time.sleep(1)
		except:
			print(f'Exception on gateway worker: ("{gateway_addr}","{func_name}") {_time()}')
			import traceback
			traceback.print_exc()
			del traceback
			time.sleep(1)
	print(f'Gateway worker stopped: ("{gateway_addr}","{func_name}") {_time()}')

def start_worker(gateway_addr, gateway_api_key, func_name, handle_rpc):
	_thread.start_new_thread(worker_thread_, (gateway_addr, gateway_api_key, func_name, handle_rpc))

def stop_worker(gateway_addr, func_name):
	assert (gateway_addr, func_name) in _worker_status
	_worker_status[(gateway_addr, func_name)] = False

# if __name__ == '__main__':
# 	try:
# 		res = send_ajax_rpc_request('localhost:8000/ajax', 'chat', api_key='orange22', chat_id=-1, query='Hello', params={})
# 		print(res)
# 		res = send_ajax_rpc_request('localhost:8000/ajax', 'audio_to_text', api_key='orange22', b64='ABCD==')
# 		print(res)
# 		res = send_ajax_rpc_request('localhost:8000/ajax', 'stop_server', None)
# 		print(res)
# 	except RuntimeError as ex:
# 		print('错误:')
# 		print(str(ex))
