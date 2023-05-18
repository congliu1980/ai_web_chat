# 网站不被chrome信任，需要填入 http://localhost:8000 然后Enable
# chrome://flags/#unsafely-treat-insecure-origin-as-secure

import mdl
_App = mdl._App
toast = mdl.toast
Section = mdl.Section
Center = mdl.Center
Container = mdl.Container
Column = mdl.Column
Row = mdl.Row
Text = mdl.Text
Badge = mdl.Badge
Textfield = mdl.Textfield
EdgeInsets = mdl.EdgeInsets
Themes = mdl.Themes
Dialog = mdl.Dialog
Card = mdl.Card
CardTitle = mdl.CardTitle
CardText = mdl.CardText
CardAction = mdl.CardAction
Colors = mdl.Colors
Table = mdl.Table
Button = mdl.Button
Icon = mdl.Icon
IconToggle = mdl.IconToggle
Switch = mdl.Switch
Footer = mdl.Footer
FooterLeft = mdl.FooterLeft
Slider = mdl.Slider
MainAxisSize = mdl.MainAxisSize
MainAxisAlignment = mdl.MainAxisAlignment
CrossAxisAlignment = mdl.CrossAxisAlignment
BorderRadius = mdl.BorderRadius
Image = mdl.Image
List = mdl.List
ListItem = mdl.ListItem
BoxShadow = mdl.BoxShadow
Offset = mdl.Offset

js = javascript
doc = js.document

info_dialog = None
recording_dialog = None
text_input_dialog = None
stop_server_dialog = None

dialog_data = {
	'朗读语言': {
		'choice': '不朗读',
		'choices': {'美式英语':'en-US', '英式英语':'en-GB', '普通话':'zh-CN', '粤语':'zh-HK', '不朗读':''},
	},
	'最长录音时长': {
		'choice': '10秒',
		'choices': {'10秒':10, '30秒':30, '1分钟':60, '2分钟':120},
	},
	'最长对话长度': {
		'choice': '8K',
		'choices': {'1K':1024, '2K':2048, '4K':4096, '8K':8192},
	},
	'回答随机性': {
		'choice': '较不随机',
		'choices': {'不随机':0, '较不随机':.3, '较随机':.7, '很随机':1},
	},
	'回答置信度': {
		'choice': '高',
		'choices': {'高':1, '较高':.7, '较低':.3, '低':0},
	},
}
def get_dialog(dialog_name):
	data = dialog_data[dialog_name]
	if 'dialog' not in data:
		dialog = Dialog(actions_full_width=True, title=dialog_name, actions=list(data['choices'].keys()))
		dialog.render(doc.body)
		data['dialog'] = dialog
	return data['dialog']

def setting_page():
	global stop_server_dialog
	# stop_server_pwd = ''
	if stop_server_dialog is None:
		# def set_stop_server_pwd(v):
		# 	nonlocal stop_server_pwd
		# 	stop_server_pwd = v
		# stop_server_dialog_content = Container(Textfield('', label='关闭服务器的密码', floating_label=True, onchange=set_stop_server_pwd))
		stop_server_dialog = Dialog(actions_full_width=True, 
									# content=stop_server_dialog_content, 
									title='关闭服务器', actions=['确定','取消'])
		stop_server_dialog.render(doc.body)
	def stop_server(ev):
		res = stop_server_dialog.show()
		if res=='确定':
			try:
				import ajax
				res = ajax.rpc.stop_server()
				info_dialog.show(res, '注意')				
			except Exception as ex:
				info_dialog.show(str(ex), '错误')
	def get_setting_list(dialog_names=list(dialog_data.keys())):
		res = []
		for name in dialog_names:
			data = dialog_data[name]
			if 'value' not in data:
				data['value'] = data['choices'][data['choice']]
			def make_action(name, data):
				def action(ev):
					dialog = get_dialog(name)
					choice = dialog.show()
					data['choice'] = choice
					data['value'] = data['choices'][choice]
					setting_container.replace_child(make_list())
				return action			
			item = ListItem(text=name,
							sub_title=data['choice'],
							action=Button(Icon('edit'), icon=True, primary=True, action=make_action(name, data)),
							)
			res.append(item)
		return res
	def make_list():
		return List(
			*get_setting_list(),
			ListItem(text='关闭服务器',
					action=Button(Icon('power_off'), icon=True, primary=True, action=stop_server),
					),
			)
	setting_container = Container(make_list(), 
		padding=EdgeInsets.all(20),
		bg_color=Colors('#EEEEEE'),
		)
	return setting_container


def chat_page():
	import _thread
	import time
	import ajax
	import json
	recording = False
	messages = []
	prev_text_line = {}
	def speech_synthesis(text, query_id, done):
		if query_id not in prev_text_line:
			prev_text_line[query_id] = 0
		text = text.split('\n')
		text = [t.strip() for t in text]
		text = [t for t in text if t!='']
		if done:
			text, prev_text_line[query_id] = text[prev_text_line[query_id]:], 10000
		else:
			text = text[prev_text_line[query_id]:-1]
			prev_text_line[query_id] = prev_text_line[query_id] + len(text)
		else:
			text = []
		for t in text:
			if dialog_data['朗读语言']['value']!='':
				js.speak(t, dialog_data['朗读语言']['value'])
	next_query_id = 0
	def send_query(query, query_id):
		if len(query)==0:
			info_dialog.show('语音识别错误', '错误')
			return
		query = query[0]
		nonlocal messages
		prev_turns = len(messages)
		max_length = dialog_data['最长对话长度']['value']
		temperature = dialog_data['回答随机性']['value']
		top_p = dialog_data['回答置信度']['value']
		len_message = len(messages)
		params = {'messages': messages, 'max_length':max_length, 'temperature':temperature, 'top_p':top_p}
		chat_id = -1
		canceled = False
		query_ = query
		while True:
			chat_ = ajax.rpc.chat(chat_id, query_, params)
			canceled = query_id!=next_query_id
			if canceled and (query_ is True):
				break
			params = {}
			chat_id = chat_['chat_id']
			if (chat_ is None) or ('exception' in chat_):
				if 'exception' in chat_:
					info_dialog.show(chat_['exception'], '服务器发生异常')
				break
			conv = []
			messages = chat_['messages']
			for i,(role,message) in enumerate(messages):
				if (i%2)==0:
					conv.append([message,None])
				else:
					conv[-1][1] = message
			conv = conv[::-1]
			if chat_['queue_index']>0:
				index, size = chat_['queue_index'], chat_['queue_size']
				if (len(conv)>0) and (conv[0][0]==query):
					conv[0][1] = f'正在排队 {index}/{size}'
				else:
					conv = [[query,f'正在排队 {index}/{size}']] + conv
				chat_container.replace_child(make_list(conv))
				time.sleep(1)
			else:
				has_new = (not canceled)
				if (has_new and (len(conv)>0)) and (conv[0][1] is not None):
					if len(messages)>len_message:
						speech_synthesis(conv[0][1], query_id, False)
						chat_container.replace_child(make_list(conv))
					if chat_['done']:
						speech_synthesis(conv[0][1], query_id, True)
						js.hljs.highlightAll()
						break
				time.sleep(.1)
			canceled = query_id!=next_query_id
			query_ = canceled
	def start_recording(ev):
		js.speechSynthesis.cancel()
		nonlocal next_query_id
		next_query_id = next_query_id+1
		js.start_recording(start_recording_callback)
	def stop_recording_thread(b64):
		err_msg, text = ajax.rpc.audio_to_text(b64)
		if err_msg!='':
			info_dialog.show(err_msg, '错误')
		else:
			try:
				send_query([text], next_query_id)
			except RuntimeError as ex:
				info_dialog.show(str(ex), '错误')
	# def _stop_recording(canceled):
	# 	def stop_recording_callback(err, text):
	# 		if not canceled:
	# 			if err!='':
	# 				info_dialog.show(err, '错误')
	# 			else:
	# 				_thread.start_new_thread(send_query, (text, next_query_id))
	# 	js._stop_recording(stop_recording_callback)
	def stop_recording(canceled):
		def stop_recording_callback(b64):
			if not canceled:
				_thread.start_new_thread(stop_recording_thread, (b64,))
		js.stop_recording(stop_recording_callback)
	def start_recording_callback(succ):
		_thread.start_new_thread(start_recording_, (succ,))
	def start_recording_(succ):
		nonlocal recording
		if not succ:
			info_dialog.show('用户拒绝录音或浏览器不支持', '错误')
			return
		recording = True
		global recording_dialog
		time_left = dialog_data['最长录音时长']['value']
		def timeout_text():
			m,s = time_left//60, time_left%60
			return f'<b>剩余时间 {m}:{"" if s>9 else 0}{s}</b>'
		timeout_container = Container(Text(timeout_text()))
		dialog_content = Column(
			Image('/web/🎙️.png'),
			timeout_container,
			)
		if recording_dialog is None:
			recording_dialog = Dialog(actions_full_width=True, 
									title='请讲话', 
									actions=['完成','取消'])
			recording_dialog.render(doc.body)
		def timeout_thread():
			nonlocal time_left, recording
			while recording:
				time.sleep(1)
				if recording:
					time_left = time_left-1
					timeout_container.replace_child(Text(timeout_text()))
					if time_left<=0:
						recording = False
						recording_dialog.close()
						stop_recording(False)
		_thread.start_new_thread(timeout_thread, ())
		act = recording_dialog.show(content=dialog_content)
		recording = False
		if act=='完成':
			stop_recording(False)
		else:
			stop_recording(True)
	def make_list(history):
		rows = []
		for human_text, robot_text in history:
			if robot_text is not None:
				robot_text = js.marked.parse(robot_text).data()
				robot_row = Row(
					Row(
						Container(
							Image('web/🤖.png', width=20),
							margin=EdgeInsets.only(right=5, bottom=5),
							),
						Container(
							Text(robot_text),
							padding=EdgeInsets.only(10,10,0,10),
							borderRadius=BorderRadius.only(0,20,20,20),
							bg_color=Colors('#FFFFFF'),
							boxShadow=[BoxShadow(color=Colors('#BBBBBB'), offset=Offset(2,2), blurRadius=10)],
							),
						margin=EdgeInsets.only(bottom=15),
						crossAxisAlignment=CrossAxisAlignment.start,
						),
					Container(Text('　　　　　')),
					mainAxisAlignment=MainAxisAlignment.spaceBetween,
					)
				rows.append(robot_row)
			if human_text is not None:
				# human_text = js.marked.parse(human_text).data()
				human_text = ''.join([f'<p>{p.strip()}</p>' for p in human_text.split('\n')])
				human_row = Row(
					Container(Text('　　　　　')),
					Row(
						Container(
							Text(human_text),
							padding=EdgeInsets.only(10,10,0,10),
							borderRadius=BorderRadius.only(20,20,0,20),
							bg_color=Colors('#CCFFCC'),
							boxShadow=[BoxShadow(color=Colors('#AACCAA'), offset=Offset(2,2), blurRadius=10)],
							),
						Container(
							Image('web/👧.png', width=20),
							margin=EdgeInsets.only(left=5, top=5),
							),
						margin=EdgeInsets.only(bottom=15),
						crossAxisAlignment=CrossAxisAlignment.end,
						mainAxisAlignment=MainAxisAlignment.end,
						),
					mainAxisAlignment=MainAxisAlignment.spaceBetween,
					)
				rows.append(human_row)
		return Column(
			*rows,
			padding=EdgeInsets.only(15,5,0,5),
			bg_color=Colors('#EEEEEE'),
			crossAxisAlignment=CrossAxisAlignment.stretch,
			)
	greating = '可以聊天啦! Chat with me!'
	chat_container = Container(make_list([[None,greating]]), width='100%')
	mic_button = Button(
		Icon('mic'),
		fab=True,
		action=start_recording, 
		ripple_effect=True, 
		raised=True, 
		accent=True,
		floating_fixed=True,
		floating_bottom=30,
		floating_right=30,
		)

	text_inpu_text = ''
	def set_text_inpu_text(v):
		nonlocal text_inpu_text
		text_inpu_text = v
	text_input_textfield = Textfield(label='聊天输入', rows=5,
									floating_label=True, onchange=set_text_inpu_text)
	text_input_dialog = Dialog(Container(text_input_textfield), 
								actions_full_width=True, title='文字聊天', 
								actions=['确定','取消'])
	text_input_dialog.render(doc.body)
	def input_text(ev):
		res = text_input_dialog.show()
		if res=='确定':
			js.speechSynthesis.cancel()
			nonlocal next_query_id
			next_query_id = next_query_id+1
			try:
				send_query([text_inpu_text], next_query_id)
			except RuntimeError as ex:
				info_dialog.show(str(ex), '错误')
	text_button = Button(
		Icon('keyboard'),
		fab=True,
		action=input_text, 
		ripple_effect=True, 
		raised=True, 
		floating_fixed=True,
		floating_bottom=30,
		floating_right=110,
		)
	def clear_text(ev):
		js.speechSynthesis.cancel()
		nonlocal next_query_id
		next_query_id = next_query_id+1
		nonlocal messages
		messages = []
		chat_container.replace_child(make_list([[None,greating]]))
	clear_button = Button(
		Icon('cleaning_services'),
		fab=True,
		action=clear_text, 
		ripple_effect=True, 
		raised=True, 
		floating_fixed=True,
		floating_bottom=30,
		floating_right=190,
		)
	return Column(
		chat_container,
		clear_button,
		text_button,
		mic_button,
		)


def run_app():
	Themes(primary='amber', accent='red').apply()
	app = _App(title="聊天",
				app_icon="/web/🤖.png",
				fixed_header=True,
				sections=[
					Section('聊天', child=chat_page()),
					Section('设置', child=setting_page()),
					],
				# footer=Footer(FooterLeft(title='')),
				)
	app.render(doc.body)
	global info_dialog
	info_dialog = Dialog(actions_full_width=True, actions=['确定'])
	info_dialog.render(doc.body)
	js.marked.setOptions({
		'renderer': js.marked.Renderer.new(),
		'gfm': True,
		'pendantic': False,
		'sanitize': False,
		'tables': True,
		'breaks': False,
		'smartLists': True,
		'smartypants': False,
		'highlight': lambda code,_: js.hljs.highlightAuto(code).value.data() 
		})

run_app()
