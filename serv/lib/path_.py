
import os

# try:
# 	import machine
# 	is_micropython = True
# except:
# 	is_micropython = False

def flash_size_(flash_):
	statvfs_fields_ = ['bsize', 'frsize', 'blocks', 'bfree', 'bavail', 'files', 'ffree', ]
	info_ = dict(zip(statvfs_fields_, os.statvfs(flash_)))
	return info_['bsize'] * info_['bfree']

def join_(*args):
	if type(args[0]) is bytes:
		return b"/".join(args)
	else:
		return "/".join(args)

def split_(path_):
	if path_ == "":
		return ("", "")
	r_ = path_.rsplit("/", 1)
	if len(r_) == 1:
		return ("", path_)
	head_ = r_[0] #.rstrip("/")
	if not head_:
		head_ = "/"
	return (head_, r_[1])

def splitext_(path_):
	if path_ == "":
		return ("", "")
	r_ = path_.rsplit(".", 1)
	if len(r_) == 1:
		return (path_, "")
	r_[1] = "." + r_[1]
	return (r_[0], r_[1])

def isdir_(path_):
	try:
		mode_ = os.stat(path_)[0]
		return (mode_ & 0o170000) == 0o040000
	except OSError:
		return False

def isfile_(path_):
	try:
		mode_ = os.stat(path_)[0]
		return (mode_ & 0o170000) == 0o100000
	except OSError:
		return False
	
def exists_(path_):
	try:
		os.stat(path_)
		return True
	except:
		return False

def getmtime_(path_):
	return os.stat(path_)[8]

def getsize_(path_):
	return os.stat(path_)[6]

sep_ = '/'

