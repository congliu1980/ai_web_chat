
js = javascript
doc = js.document

def maketag(tag, attrs=None, style=None):
	elt = js.document.createElement(tag)
	if attrs is not None:
		for k,v in attrs.items():
			elt.setAttribute(k,v)
	if style is not None:
		style = ';'.join([f'{k}:{v}' for k,v in style.items()])
		elt.setAttribute('style',style)
	return elt

# https://getmdl.io/components/index.html#cards-section

class CardMedia:
	def __init__(self, image):
		assert isinstance(image, str)
		self.image = image
		self.card = None
	def render(self, parent):
		elt = maketag('div', {'class':'mdl-card__media'})
		parent.appendChild(elt)
		img = maketag('img', {'class':'article-image', 'src':self.image,
								'border':'0', 'alt':''},  {'width':'100%'})
		elt.appendChild(img)
		return elt

class CardTitle:
	def __init__(self, title=None, color=None, image=None, image_right=None, expand=False):
		assert (title is None) or isinstance(title, str)
		assert (color is None) or (type(color).__name__=='Colors')
		assert (image is None) or isinstance(image, str)
		assert (image_right is None) or isinstance(image_right, float)
		assert isinstance(expand, bool)
		self.title = title
		self.color = color
		self.image = image
		self.image_right = image_right
		self.expand = expand
		self.card = None
	def render(self, parent):
		attr = {'class':'mdl-card__title'}
		if self.expand or (self.card.height is not None):
			attr = {'class':'mdl-card__title mdl-card--expand'}
		style = {}
		if self.image is None:
			style['padding-bottom'] = '0'
		if self.color is not None:
			style['color'] = str(self.color)
		elif (self.card is not None) and (self.card.color is not None):
			style['color'] = str(self.card.color)
		# if self.image is None:
		# 	style['align-items'] = 'flex-start'
		if self.image is not None:
			bg_image = f'url("{self.image}")'
			if self.image_right is None:
				bg_image = bg_image + ' center / cover'
			else:
				bg_image = bg_image + f' bottom right {int(100*self.image_right)}% no-repeat'
			style['background'] = bg_image
		title = maketag('div', attr, style)
		parent.appendChild(title)
		if self.title is not None:
			if self.image is None:
				title_text = maketag('h4', style={'margin-top':'0'})
			else:
				title_text = maketag('h2', {'class':'mdl-card__title-text'})
			title_text.innerHTML = self.title.replace('\n','<br>')
			title.appendChild(title_text)
		return title
		

class CardText:
	def __init__(self, text, expand=False):
		assert isinstance(text, str)
		assert isinstance(expand, bool)
		self.text = text
		self.card = None
		self.expand = expand
	def render(self, parent):
		attr = {'class':'mdl-card__supporting-text'}
		if self.expand:
			attr = {'class':'mdl-card__supporting-text mdl-card--expand'}
		style = {'color':str(self.card.color)} if (self.card is not None) and (self.card.color is not None) else {}
		text = maketag('div', attr, style)
		parent.appendChild(text)
		text.appendChild(doc.createTextNode(self.text))

class CardAction:
	def __init__(self, text, action, icon=None):
		assert isinstance(text, str)
		assert (action is None) or callable(action)
		assert (icon is None) or (type(icon).__name__=='Icon')
		self.text = text
		self.action = action
		self.icon = icon
		self.card = None
	def render(self, parent):
		attr = {'class':'mdl-card__actions mdl-card--border'}
		style = {'display':'flex','box-sizing':'border-box','align-items':'center'}
		actions = maketag('div', attr, style)
		parent.appendChild(actions)
		attr = {'class':'mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect mdl-button--accent'}
		style = {} if (self.card is None) or (self.card.color is None) else {'color':str(self.card.color)}
		a = maketag('a', attr, style)
		actions.appendChild(a)
		a.appendChild(doc.createTextNode(self.text))
		if self.action is not None:
			a.bind('click', self.action)
		if self.icon is not None:
			spacer = maketag('div', {'class':'mdl-layout-spacer'})
			actions.appendChild(spacer)
			icon = maketag('i', {'class':'material-icons'},
							{'padding-right':'10px'})
			actions.appendChild(icon)
			icon.appendChild(doc.createTextNode(str(self.icon)))			

class Card:
	def __init__(self, *items, width=None, height=None, shadow=None,
			color=None, background_color=None, image_bg=None):
		assert (width is None) or isinstance(width, int)
		assert (height is None) or isinstance(height, int)
		assert (color is None) or (type(color).__name__=='Colors')
		assert (background_color is None) or (type(background_color).__name__=='Colors')
		assert (shadow is None) or isinstance(shadow, int)
		assert (image_bg is None) or isinstance(image_bg, str)
		for item in items:
			assert isinstance(item, (CardMedia, CardTitle, CardText, CardAction)) or (type(item).__name__=='Container')
		self.width = width
		self.height = height
		self.color = color
		self.background_color = background_color
		self.shadow = shadow
		self.image_bg = image_bg
		self.items = items
	def render(self, parent):
		style = {}
		if self.width is not None:
			style['width'] = f'{self.width}px'
		else:
			style['width'] = '100%'
			style['height'] = '100%'
		if self.height is not None:
			style['height'] = f'{self.height}px'
		if self.color is not None:
			style['color'] = str(self.color)
		if self.background_color is not None:
			style['background'] = str(self.background_color)
		if self.image_bg is not None:
			image_bg = f'url({self.image_bg}) center / cover'
			if 'background' in style:
				style['background'] = f"{style['background']} {image_bg}"
			else:
				style['background'] = image_bg
		cls = 'mdl-card'
		if self.shadow is not None:
			cls = cls + f' mdl-shadow--{self.shadow}dp'
		attr = {'class':cls}
		elt = maketag('div', attr, style)
		parent.appendChild(elt)
		for item in self.items:
			if isinstance(item, (CardMedia, CardTitle, CardText, CardAction)): 
				item.card = self
			item.render(elt)
		return elt
