
let chunks = []
let mediaRecorder = null

function start_recording(callback) {
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
	 	navigator.mediaDevices.getUserMedia({audio:true})
		.then((stream) => {
			mediaRecorder = new MediaRecorder(stream)
			mediaRecorder.ondataavailable = (e) => {
				chunks.push(e.data)
			}
			mediaRecorder.start()
			callback(true)
		})
		.catch((err) => {
			callback(false)
		})
	} else {
		callback(false)
	}
}

// function _audio_to_text(blob, callback) {
// 	let form_data = new FormData()
// 	form_data.append('record.ogg', blob)
// 	let xhr = new XMLHttpRequest()
// 	xhr.open('POST', '/audio', true)
// 	let err = null, text = null
// 	function onload_callback(ev) {
// 		if (xhr.status==200) {
// 			let data = JSON.parse(xhr.responseText)
// 			callback(data[0], data[1])
// 		}
// 		else
// 			callback('网络错误', null)
// 	}
// 	xhr.onload = onload_callback
// 	xhr.processData = false
// 	xhr.contentType = false
// 	xhr.send(form_data)
// }

// function _stop_recording(callback) {
// 	if (mediaRecorder===null)
// 		return
// 	mediaRecorder.onstop = (e) => {
// 		let blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" })
// 		chunks = []
// 		mediaRecorder = null
// 		_audio_to_text(blob, callback)
// 	}
// 	mediaRecorder.stop()
// }

// function print_blob_20(blob) {
// 	blob.arrayBuffer().then(buffer => {
// 		let view = new Int8Array(buffer)
// 		let buf = []
// 		for (var i=0;i<10;++i)
// 			buf.push(view[i])
// 		for (var i=view.length-10;i<view.length;++i)
// 			buf.push(view[i])
// 		console.log(view.length, buf)
// 	})	
// }

function stop_recording(callback) {
	if (mediaRecorder===null)
		return
	mediaRecorder.onstop = (e) => {
		let blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" })
		chunks = []
		let reader = new FileReader()
		reader.onload = (e) => {
			let res = e.target.result
			res = res.split(',')[1]
			callback(res)
		}
		reader.readAsDataURL(blob)
	}
	mediaRecorder.stop()
}

function speak(text, lang) {
	let u = new SpeechSynthesisUtterance(text)
	u.lang = lang
	window.speechSynthesis.speak(u)
}

function speak(text, lang) {
	let u = new SpeechSynthesisUtterance(text)
	u.lang = lang
	speechSynthesis.speak(u)
}