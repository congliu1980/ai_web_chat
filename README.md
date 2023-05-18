# Web Chat

## 介绍

- 具有语音识别和语音合成功能的AI聊天机器人

<img src=1.png width=310 /> <img src=2.png width=323 />

## 本项目使用了以下开源项目
- 对话式语言模型: 清华大学的[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B) 或 [Vicuna](https://github.com/lm-sys/FastChat)
- 语音识别模型: OpenAI的[Whisper](https://github.com/openai/whisper)
- 网页框架: Google的[Material Design Lite](https://getmdl.io/)

## 测试环境

- 服务器: Ubuntu18.04, Python3.9.7, PyTorch1.13.1+cu117, RTX 3090
- 客户端: Mac OS, Chrome

## 安装教程

1.  下载清华大学的[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)
    - [https://github.com/THUDM/ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)
    - 在上面地址下载项目源代码zip包并解压到路径 ~/Desktop/ChatGLM-6B/ (这是一个参考路径，如不使用该参考路径，下文中的所有路径作相应修改即可)
    - 按照[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)的要求安装[依赖](https://github.com/THUDM/ChatGLM-6B/blob/main/requirements.txt) 
    - 如果使用的是[Vicuna](https://github.com/lm-sys/FastChat)，请按照[Vicuna](https://github.com/lm-sys/FastChat)的要求下载和合并模型，并把模型文件放在目录: ~/Desktop/FastChat/vicuna/
2.  下载OpenAI的[Whisper](https://github.com/openai/whisper)
    - [https://github.com/openai/whisper](https://github.com/openai/whisper)
    - 在上面地址下载项目源代码zip包把项目中的whisper文件夹移动到 ~/Desktop/ChatGLM-6B/whisper/
    - 按照[Whisper](https://github.com/openai/whisper)的要求安装[依赖](https://github.com/openai/whisper/blob/main/requirements.txt)
3.  下载本项目
    - 在本页面下载项目源代码zip包并解压到路径 ~/Desktop/ChatGLM-6B/
        - 解压后本项目的两个文件夹分别存放在: ~/Desktop/ChatGLM-6B/serv/ 和 ~/Desktop/ChatGLM-6B/web/
    - 配置[Whisper](https://github.com/openai/whisper)和[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B): 可以根据部署环境的限制和性能需求更改 ~/Desktop/ChatGLM-6B/serv/\_\_main\_\_.py 中45-52行的内容来制定Whisper和[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)的配置，配置方法在上述[Whisper](https://github.com/openai/whisper)和[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)的github页面中有详细的描述

## 使用说明

1.  python -m serv [本地服务器端口] [外网门户服务器地址]
    - 启动需要时间：启动[Whisper](https://github.com/openai/whisper)和[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)
    - 第一次启动需要下载[Whisper](https://github.com/openai/whisper)和[ChatGLM-6B](https://github.com/THUDM/ChatGLM-6B)的模型，可能需要较长时间
    - 当显示 “启动网页服务器”，表示启动完毕
    - 本地启动服务器能在外网被访问
        - python3 -m serv # 默认端口8000
        - sudo python3 -m serv 80
    - 本地启动服务器不能在外网被访问，需要同时启动外网门户服务器
        - 外网门户服务器(no-gpu-server.com) sudo python3 -m serv 80
        - 本地带GPU的服务器 python3 -m serv 8000 http://no-gpu-server.com:80

2.  在浏览器中输入 http://服务器地址[:端口] 如 http://localhost:8000 或 http://no-gpu-server.com:80
    - 第一次使用，需要同意浏览器使用麦克风
    - 如果从其他电脑的浏览器访问，需要让浏览器信任服务器所在的网站，才能使浏览器允许使用麦克风
        - 例如，对于chrome浏览器，需要在地址栏输入 chrome://flags/#unsafely-treat-insecure-origin-as-secure
        - 然后，在指定的文本框中输入服务器地址 http://..., 然后点击 Enable
