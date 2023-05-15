
import os, socket, gc, json, time, sys
from .path_ import exists_

class Route_:
	def __init__(self, route_, method_, client_addr_, func_, route_args_):
		self.route_ = route_		
		self.method_ = method_	   
		self.client_addr_ = client_addr_		 
		self.func_ = func_		 
		self.route_args_ = route_args_

mime_types_ = {
	".txt"  : "text/plain",
	".htm"  : "text/html",
	".html" : "text/html",
	".css"  : "text/css",
	".csv"  : "text/csv",
	".js"	: "application/javascript",
	".py"   : "application/python",
	".c"   : "application/c",
	".h"   : "application/c",
	".xml"  : "application/xml",
	".xhtml": "application/xhtml+xml",
	".json" : "application/json",
	".zip"  : "application/zip",
	".pdf"  : "application/pdf",
	".ts"	: "application/typescript",
	".woff" : "font/woff",
	".woff2": "font/woff2",
	".ttf"  : "font/ttf",
	".otf"  : "font/otf",
	".jpg"  : "image/jpeg",
	".jpeg" : "image/jpeg",
	".png"  : "image/png",
	".gif"  : "image/gif",
	".svg"  : "image/svg+xml",
	".ico"  : "image/x-icon",
	".mp3"  : "audio/mpeg3",
	".mp4"  : "video/mp4",
	".map"  : "application/x-httpd-imap",
}

def get_mime_type_from_filename_(filename_):
	filename_ = filename_.lower()
	for ext_ in mime_types_:
		if filename_.endswith(ext_):
			return mime_types_[ext_]
	return None

# html_escape_chars_ = {
# 	"&": "&amp;",
# 	'"': "&quot;",
# 	"'": "&apos;",
# 	">": "&gt;",
# 	"<": "&lt;"
# }

# def HTML_escape_(s):
# 	return ''.join(html_escape_chars_.get(c, c) for c in s)

def unquote_(s):
	r = str(s).split('%')
	try:
		b = r[0].encode()
		for i in range(1, len(r)):
			try:
				b += bytes([int(r[i][:2], 16)]) + r[i][2:].encode()
			except:
				b += b'%' + r[i].encode()
		return b.decode('UTF-8')
	except:
		return str(s)

def unquote_plus_(s):
	return unquote_(s.replace('+', ' '))

# def exists_(path_):
# 	try:
# 		os.stat(path_)
# 		return True
# 	except:
# 		return False

################################################################################

class Http_:
	STATIC_CONTENT_CACHE_LEVEL = 1
	BACKLOG = 16 # 还没有接手处理或正在进行的连接

	def __init__(self, ip_, port_, web_path_, max_threads_):
		self.server_addr_ = (ip_, port_)
		if web_path_.endswith('/'):
			web_path_ = web_path_[:-1]
		self.web_path_ = web_path_
		self.started_ = False
		self.max_threads_ = max_threads_
		self.thread_count_ = 0
		self.route_handlers_ = []

	def add_route_(self, url_, func_, method_='GET', client_addr_=''):
		if url_.startswith('/'):
			url_ = url_[1:]
		if url_.endswith('/'):
			url_ = url_[:-1]
		route_parts_ = url_.split('/')
		route_args_ = []
		for s in route_parts_:
			if s.startswith('{') and s.endswith('}'):
				route_args_.append(s[1:-1])
		self.route_handlers_.append(Route_(route_parts_, method_, client_addr_, func_, route_args_))

	def get_route_handler_(self, url_, method_, client_addr_):
		if url_.startswith('/'):
			url_ = url_[1:]
		if url_.endswith('/'):
			url_ = url_[:-1]
		route_parts_ = url_.split('/')
		method_ = method_.upper()
		def match_route_parts_(route_parts_, url_):
			if len(route_parts_) != len(url_):
				return None
			args_ = {}
			for up_, u_ in zip(route_parts_, url_):
				if up_.startswith('{') and up_.endswith('}'):
					args_[up_[1:-1]] = u_
				elif up_ != u_:
					return None
			return args_
		for rh_ in self.route_handlers_:
			if rh_.method_ == method_ and client_addr_.startswith(rh_.client_addr_):
				args_ = match_route_parts_(rh_.route_, url_.split('/'))
				if args_ is not None:
					return rh_.func_, args_
		return None, None

	def start_(self):
		assert not self.started_
		self.server_ = socket.socket()
		self.server_.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
		self.server_.bind(self.server_addr_)
		self.server_.listen(Http_.BACKLOG)
		self.started_ = True
		while self.started_:
			try:
				client_socket_, client_addr_ = self.server_.accept()
			except KeyboardInterrupt as ex_:
				break
			except Exception as ex_:
				print(ex_)
				# print(ex_.args)
				# sys.print_exception(ex_)
				continue
				# if ex_.args and ex_.args[0] == 113: break
				# continue
			if self.max_threads_ == 0:
				self.thread_count_ += 1
				self.client_thread_(client_socket_, client_addr_)
			else:
				import _thread
				try:
					_thread.start_new_thread(self.client_thread_, (client_socket_, client_addr_))
					self.thread_count_ += 1
				except OSError as ex:
					print(str(ex))
				while self.thread_count_ >= self.max_threads_:
					time.sleep(0.1)
		self.started_ = False

	def client_thread_(self, client_socket_, client_addr_):
		Request_(self, client_socket_, client_addr_)
		self.thread_count_ -= 1

	def stop_(self):
		if self.started_:
			self.started_ = False
			self.server_.close()

	def is_started_(self):
		return self.started_

	def local_path_from_url_(self, url_):
		if url_[0] == '/':
			url_ = url_[1:]
		if not url_.startswith('web/'):
			return None
		url_ = url_[4:]
		path_ = self.web_path_ + '/' + url_.replace('../', '/')
		if exists_(path_):
			return path_
		return None

################################################################################

def parse_params_(query_, delimitor1_='&', delimitor2_='='):
	params_ = {}
	elements_ = query_.split(delimitor1_)
	for element_ in elements_:
		param_ = element_.split(delimitor2_, 1)
		if len(param_) > 0:
			value_ = param_[1] if len(param_) > 1 else ''
			params_[param_[0]] = value_
	return params_

def http_handle_ex_(ex):
	if hasattr(sys, 'print_exception'):
		sys.print_exception(ex)
		return ''
	else:
		from io import StringIO
		import traceback
		fp = StringIO()
		traceback.print_exc(file=fp)
		del traceback
		fp.flush()
		return fp.getvalue()

class Request_:

	def __init__(self, http_, socket_, addr_):
		socket_.settimeout(2)
		self.http_ = http_
		self.socket_ = socket_
		self.addr_ = addr_
		self.method_ = None
		self.path_ = None
		self.http_version_ = None
		self.params_ = {}
		self.headers_ = {}
		self.content_type_ = None
		self.content_length_ = 0
		
		if hasattr(socket, 'readline'): # MicroPython
			self.socket_file_ = self.socket_
		else: # CPython
			self.socket_file_ = self.socket_.makefile('rwb')

		try:
			response_ = Response_(self)
			if self.parse_first_line_():
				if self.parse_header_():
					self.read_request_posted_form_data_()
					route_handler_, route_args_ = self.http_.get_route_handler_(self.path_, self.method_, self.addr_[0])
					if route_handler_:
						route_handler_(self, response_, route_args_)
					else:
						self.write_file_(response_)
				else:
					response_.write_response_bad_request_()
		except Exception as ex_:
			err_msg_ = http_handle_ex_(ex_)
			print(err_msg_)
			response_.write_response_internal_server_error_(err_msg_)
		finally:
			try:
				if self.socket_file_ is not self.socket_:
					self.socket_file_.close()
				self.socket_.close()
			except:
				print('Exception while closing socket_file')
				pass

	def parse_first_line_(self):
		try:
			elements_ = self.socket_file_.readline().decode().strip().split()
			if len(elements_) == 3:
				self.method_  = elements_[0].upper()
				self.path_	= elements_[1]
				self.http_version_ = elements_[2].upper()
				elements_ = self.path_.split('?', 1)
				if len(elements_) > 0:
					self.path_ = unquote_plus_(elements_[0])
				if len(elements_) > 1:
					params_ = parse_params_(elements_[1])
					self.params_ = {unquote_plus_(k):unquote_plus_(v) for k,v in params_.items()}
				return True
		except:
			pass
		return False

	def parse_header_(self):
		while True:
			elements_ = self.socket_file_.readline().decode().strip().split(':', 1)
			if len(elements_) == 2:
				self.headers_[elements_[0].strip().lower()] = elements_[1].strip()
			elif len(elements_) == 1 and len(elements_[0]) == 0:
				if self.method_ == 'POST' or self.method_ == 'PUT':
					self.content_type_   = self.headers_.get("content-type", None)
					self.content_length_ = int(self.headers_.get("content-length", 0))
				return True
			else:
				return False

	def read_request_content_(self, size_=None):
		if size_ is None:
			size_ = self.content_length_
		if size_ > 0:
			try:
				return self.socket_file_.read(size_)
			except:
				pass
		return b''

	def read_request_posted_form_data_(self):
		if 'content-type' not in self.headers_:
			return
		data_ = self.read_request_content_()
		if self.headers_['content-type'] == 'application/x-www-form-urlencoded':
			data_ = data_.decode()
			data_ = parse_params_(data_)
			data_ = {unquote_plus_(k):unquote_plus_(v) for k,v in data_.items()}			
			self.params_.update(data_)
		elif self.headers_['content-type'].startswith('multipart/form-data;'):
			boundary_ = self.headers_['content-type'].split(';')[1].split('=')[1]
			boundary_ = '--' + boundary_
			data_ = data_.split(boundary_.encode())
			data_ = data_[1:-1]
			for d_ in data_:
				d_ = d_[2:-2].split(b'\r\n\r\n')
				assert d_[0].startswith(b'Content-Disposition: form-data; ')
				part1_ = d_[0].decode().split('; ', 1)[1]
				lines_ = part1_.split('\r\n')
				if len(lines_) == 1:
					d1_ = parse_params_(unquote_plus_(lines_[0]), '; ')
					assert len(d1_) == 1 and 'name' in d1_, part1_
					name_ = json.loads(d1_['name'])
					self.params_[name_] = d_[1].decode()
				else:
					assert len(lines_) == 2, part1_
					d1_ = parse_params_(unquote_plus_(lines_[0]), '; ')
					assert len(d1_) == 2 and 'name' in d1_ and 'filename' in d1_, part1_
					name_ = json.loads(d1_['name'])
					filename_ = json.loads(d1_['filename'])
					self.params_[name_] = {'filename':filename_, 'file':d_[1]}
		else:
			assert False, 'Content-type unsupported: %s' % self.headers_['content-type']

	def write_file_(self, response_, path_=None):
		if path_ is None:
			path_ = self.path_
		filepath_ = self.http_.local_path_from_url_(path_)
		if filepath_:
			content_type_ = get_mime_type_from_filename_(filepath_)
			if content_type_:
				if Http_.STATIC_CONTENT_CACHE_LEVEL > 0:
					if Http_.STATIC_CONTENT_CACHE_LEVEL > 1:
						if 'if-modified-since' in self.headers_:
							response_.write_response_not_modified_()
						else:
							headers_ = { 'Last-Modified': 'Fri, 1 Jan 2021 00:00:00 GMT', \
								'Cache-Control': 'max-age=315360000', \
								'Access-Control-Allow-Origin': '*' }
							response_.write_response_file_(filepath_, content_type_, headers_)
					else:
						response_.write_response_file_(filepath_, content_type_)
				else:
					response_.write_response_file_(filepath_, content_type_)
			else:
				response_.write_response_forbidden_()
		else:
			response_.write_response_not_found_()

################################################################################

http_response_codes_ = {
	200: ('OK', 'Request fulfilled, document follows'),
	302: ('Found', 'Object moved temporarily -- see URI list'),
	304: ('Not Modified', 'Document has not changed since given time'),
	400: ('Bad Request','Bad request syntax or unsupported method'),
	# 403: ('Forbidden','Request forbidden -- authorization will not help'),
	# 404: ('Not Found', 'Nothing matches the given URI'),
	405: ('Method Not Allowed', 'Specified method is invalid for this resource.'),
	# 500: ('Internal Server Error', 'Server got itself in trouble'),
	403: ('Forbidden','所请求的文件类型不在服务器允许访问的类型列表中'),
	404: ('Not Found', '服务器中找不到所请求的资源'),
	500: ('Internal Server Error', '服务器内部错误，请报告或求助于你的服务提供者'),
}

class Response_:

	def __init__(self, request_):
		self.request_ = request_

	def write_(self, data_, encoding_='UTF-8'): # 'ISO-8859-1'
		if data_:
			if type(data_) == str:
				data_ = data_.encode(encoding_)
			data_ = memoryview(data_)
			while data_:
				n_ = self.request_.socket_file_.write(data_)
				if n_ is None:
					return False
				data_ = data_[n_:]
			return True
		return False

	def write_first_line_(self, code_):
		reason_ = http_response_codes_.get(code_, ('Unknown reason', ))[0]
		return self.write_("HTTP/1.1 %s %s\r\n" % (code_, reason_))

	def write_header_(self, name_, value_):
		return self.write_("%s: %s\r\n" % (name_, value_))

	def write_content_type_header_(self, content_type_, charset_=None):
		if content_type_:
			ct_ = content_type_ + (("; charset=%s" % charset_) if charset_ else "")
		else:
			ct_ = "application/octet-stream"
		self.write_header_("Content-Type", ct_)

	def write_server_header_(self):
		self.write_header_("Server", "ESP-32")

	def write_end_header_(self):
		return self.write_("\r\n")

	def write_before_content_(self, code_, headers_, content_type_, charset_, content_length_):
		self.write_first_line_(code_)
		if isinstance(headers_, dict):
			for header_ in headers_:
				self.write_header_(header_, headers_[header_])
		if content_length_ > 0:
			self.write_content_type_header_(content_type_, charset_)
			self.write_header_("Content-Length", content_length_)
		self.write_server_header_()
		self.write_header_("Connection", "close")
		self.write_end_header_()

	def write_response_(self, code_, headers_, content_type_, charset_, content_):
		try:
			if content_:
				if type(content_) == str:
					content_ = content_.encode(charset_)
				content_length_ = len(content_)
			else:
				content_length_ = 0
			self.write_before_content_(code_, headers_, content_type_, charset_, content_length_)
			if content_:
				return self.write_(content_)
			return True
		except:
			try:
				import traceback
				print(traceback.format_exc())
			except:
				pass
			return False

	def write_response_file_(self, filepath_, content_type_=None, headers_=None):
		try:
			size_ = os.stat(filepath_)[6]
			if size_ > 0:
				with open(filepath_, 'rb') as file_:
					self.write_before_content_(200, headers_, content_type_, None, size_)
					try:
						buf_ = bytearray(256)
						while size_ > 0:
							x_ = file_.readinto(buf_)
							if x_ < len(buf_):
								buf_ = memoryview(buf_)[:x_]
							if not self.write_(buf_):
								return False
							size_ -= x_
						return True
					except BrokenPipeError:
						return False
					except Exception as ex_:
						err_msg_ = http_handle_ex_(ex_)
						print(err_msg_)
						self.write_response_internal_server_error_(err_msg_)
						return False
		except Exception as ex:
			pass
		self.write_response_not_found_()
		return False

	def write_response_OK_(self, headers_=None, content_type_=None, charset_=None, content_=None):
		return self.write_response_(200, headers_, content_type_, charset_, content_)

	def write_response_JSON_OK_(self, json_='{}', headers_=None):
		return self.write_response_(200, headers_, "application/json", "UTF-8", json_)

	def write_response_redirect_(self, location_):
		headers_ = { "Location": location_ }
		return self.write_response_(302, headers_, None, None, None)
	
	def write_response_error_(self, code_, err_msg_=None):
		response_error_tmpl_ = '<h1>%(code)d %(reason)s</h1>\n%(message)s'
		reason_, msg_ = http_response_codes_.get(code_, ('Unknown reason', ''))
		if err_msg_ is not None:
			msg_ = err_msg_
		err_msg_ = response_error_tmpl_ % {'code': code_, 'reason':reason_, 'message':msg_}
		return self.write_response_(code_, None, "text/html", "UTF-8", err_msg_)

	def write_response_JSON_error_(self, code_, json_='{}'):
		return self.write_response_(code_, None, "application/json", "UTF-8", json_)

	def write_response_not_modified_(self):
		return self.write_response_error_(304)

	def write_response_bad_request_(self):
		return self.write_response_error_(400)

	def write_response_forbidden_(self):
		return self.write_response_error_(403)

	def write_response_not_found_(self):
		return self.write_response_error_(404)

	def write_response_method_not_allowed_(self):
		return self.write_response_error_(405)

	def write_response_internal_server_error_(self, msg_=None):
		return self.write_response_error_(500, msg_)

