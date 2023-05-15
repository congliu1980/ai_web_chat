
js = javascript
doc = js.document
from mdl_ import tools
maketag = tools.maketag


class SloganSlide:
	def __init__(self, height, name=None, slogan=None, sub_slogan=None, 
				bg_color=None, image_bg=None,
				href='', href_image=None, href_text=None,
				next_href=None
				):
		assert isinstance(height, int)
		assert (name is None) or isinstance(name, str)
		assert (slogan is None) or isinstance(slogan, str)
		assert (sub_slogan is None) or isinstance(sub_slogan, str)
		assert (bg_color is None) or (type(bg_color).__name__=='Colors')
		assert (image_bg is None) or isinstance(image_bg, str)
		assert isinstance(href, str)
		assert (href_image is None) or isinstance(href_image, str)
		assert (href_text is None) or isinstance(href_text, str)
		assert (next_href is None) or isinstance(next_href, str)
		self.height = height
		self.name = name
		self.slogan = slogan
		self.sub_slogan = sub_slogan
		self.bg_color = bg_color
		self.image_bg = image_bg
		self.href = href
		self.href_image = href_image
		self.href_text = href_text
		self.next_href = next_href

	def render(self, parent):
		style = {
			'position': 'relative',
			'height': f'{self.height}px',
			'width': '100%',
		}
		if self.bg_color is not None:
			style['background-color'] = str(self.bg_color)
		if self.image_bg is not None:
			style['background'] = f'url({self.image_bg}) center 30% no-repeat'
			style['background-size'] = 'cover'
		if self.name is not None:
			parent.appendChild(maketag('a', {'name':self.name}))
		attr = {'class':'mdl-typography--text-center'}
		elt = maketag('div', attr, style)
		parent.appendChild(elt)
		logo_font= {
			'font-family': "'Roboto', 'Helvetica', 'Arial', sans-serif",
			'line-height': '1',
			'color': '#767777',
			'font-weight': '500',
		}
		if self.slogan is not None:
			style = dict(**logo_font)
			style.update({
				'font-size': '60px',
				'padding-top': '160px',
			})
			slogan = maketag('div', style=style)
			elt.appendChild(slogan)
			slogan.appendChild(doc.createTextNode(self.slogan))
		if self.sub_slogan is not None:
			style = dict(**logo_font)
			style.update({
				'font-size': '21px',
				'padding-top': '24px',
			})
			sub_slogan = maketag('div', style=style)
			elt.appendChild(sub_slogan)
			sub_slogan.appendChild(doc.createTextNode(self.sub_slogan))
		if self.href_text is not None:
			style = dict(**logo_font)
			style.update({
				'font-size': '21px',
				'padding-top': '400px',
			})
			href = maketag('div', style=style)
			elt.appendChild(href)
			style = dict(**logo_font)
			style.update({
				'text-decoration': 'none',
				'color': '#767777',
				'font-weight': '300',
			})
			a = maketag('a', {'href':self.href}, style)
			href.appendChild(a)
			if self.href_image is not None:
				a.appendChild(maketag('img', {'src':self.href_image}))
				a.appendChild(doc.createTextNode(' '+self.href_text))
		if self.next_href is not None:
			a = maketag('a', {'href':self.next_href})
			elt.appendChild(a)
			style = {
				'position': 'absolute',
				'right': '20%',
				'bottom': '-26px',
				'z-index': '3',
				'background': '#64ffda !important',
				'color': 'black !important',
			}
			attr = {'class': 'mdl-button mdl-button--colored mdl-js-button mdl-button--fab mdl-js-ripple-effect'}
			button = maketag('button', attr, style)
			a.appendChild(button)
			i = maketag('i', {'class': 'material-icons'})
			button.appendChild(i)
			i.appendChild(doc.createTextNode('expand_more'))
		return elt


class Slide:
	def __init__(self, title, content, name=None, max_width=None):
		assert isinstance(title, str)
		assert hasattr(content, 'render') and callable(content.render)
		assert (name is None) or isinstance(name, str)
		assert (max_width is None) or isinstance(max_width, int)
		self.title = title
		self.content = content
		self.name = name
		self.max_width = max_width
	def render(self, parent):
		if self.name is not None:
			parent.appendChild(maketag('a', {'name':self.name}))
		max_width = f'{self.max_width}px' if self.max_width is not None else '100%'
		style = {
			'padding': '80px 0',
			'max-width': max_width,
			'margin-left': 'auto',
			'margin-right': 'auto',
		}
		elt = maketag('div', {}, style)
		parent.appendChild(elt)
		style = {
			'margin-left': '12px',
			'padding-bottom': '24px',
		}
		attr = {'class': 'mdl-typography--display-1-color-contrast'}
		title = maketag('div', attr, style)
		elt.appendChild(title)
		title.appendChild(doc.createTextNode(self.title))
		self.content.render(elt)
		return elt
