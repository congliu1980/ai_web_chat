
doc = javascript.document

from mdl_ import colors
Colors = colors.Colors
from mdl_ import icons
Icon = icons.Icon
# Icons = icons.Icons
from mdl_ import themes
Themes = themes.Themes

from mdl_ import apps
PortfolioApp = apps.PortfolioApp

from mdl_ import cards
CardMedia = cards.CardMedia
CardTitle = cards.CardTitle
CardText = cards.CardText
CardAction = cards.CardAction
Card = cards.Card

from mdl_ import slides
Slide = slides.Slide
SloganSlide = slides.SloganSlide

from mdl_ import tools 
maketag = tools.maketag
add_class = tools.add_class
has_class = tools.has_class
remove_class = tools.remove_class
mdl_upgrade = tools.mdl_upgrade
clear_elt = tools.clear_elt

# https://getmdl.io/components/index.html#layout-section/layout

def _associate_tabs_and_sections(sections, tabs=None, links=None, drawer=None):
	cur_section = None
	class Action_:
		def __init__(self, section, drawer=None):
			self.section = section
			self.drawer = drawer
		def onclick(self, ev=None):
			if (self.drawer is not None) and has_class(self.drawer, 'is-visible'):
				doc.querySelector('.mdl-layout').MaterialLayout.toggleDrawer()
			nonlocal cur_section
			if not cur_section.switch(True): return
			if not self.section.switch(False): return
			remove_class(cur_section.section_tag, 'is-active')
			if cur_section.tab is not None:
				remove_class(cur_section.tab, 'is-active')
			cur_section = self.section
			add_class(cur_section.section_tag, 'is-active')
			if cur_section.tab is not None:
				add_class(cur_section.tab, 'is-active')
	actions = []
	for i, section in enumerate(sections):
		tab = tabs[i] if tabs is not None else None
		link = links[i] if links is not None else None
		section.tab = tab
		if i == 0:
			cur_section = section
			add_class(section.section_tag, 'is-active')
			if tab is not None:
				add_class(tab, 'is-active')
		action = Action_(section).onclick
		actions.append(action)
		if tab is not None:
			tab.bind('click', action)
		if link is not None:
			link.bind('click', Action_(section, drawer).onclick)
	return actions

def _set_tabs(bar, tag_cls, sections):
	tabs = []
	for section in sections:
		tab = maketag('a', {'class':tag_cls})
		bar.appendChild(tab)
		tab.appendChild(doc.createTextNode(section.name))
		tabs.append(tab)
	return tabs

class _App:
	def __init__(self, 
				title=None,
				app_icon=None,
				background_image=None,
				fixed_drawer=False,
				fixed_header=False,
				header_scroll=False,
				waterfall_hide_top=True,
				sections=[],
				footer=None,
				):
		assert (title is None) or isinstance(title, str)
		assert (app_icon is None) or isinstance(app_icon, str)
		assert (background_image is None) or isinstance(background_image, str)
		assert isinstance(fixed_drawer, bool)
		assert isinstance(fixed_header, bool)
		assert isinstance(header_scroll, bool)
		assert isinstance(waterfall_hide_top, bool)
		assert isinstance(sections, (tuple, list))
		for c in sections:
			assert isinstance(c, Section)
		assert (footer is None) or isinstance(footer, Footer)
		self.title = title
		self.app_icon = app_icon
		self.background_image = background_image
		self.fixed_drawer = fixed_drawer
		self.fixed_header = fixed_header
		self.header_scroll = header_scroll
		self.waterfall_hide_top = waterfall_hide_top
		self.sections = sections
		self.footer = footer

	def render(self, parent):
		if self.title is not None:
			doc.title = self.title
		if self.app_icon is not None:
			link = doc.querySelector("link[rel*='icon']")
			link.href = self.app_icon
		stylesheet = doc.createElement('style')
		parent.appendChild(stylesheet)
		elt = maketag('div', {'class':'mdl-layout mdl-js-layout'})
		parent.appendChild(elt)

		header = maketag('header', {'class':'mdl-layout__header'})
		if self.header_scroll:
			add_class(header, 'mdl-layout__header--scroll')
		else:
			add_class(header, 'mdl-layout__header--waterfall')
			if 	self.waterfall_hide_top:
				add_class(header, 'mdl-layout__header--waterfall-hide-top')
		if self.background_image is not None:
			style_text = doc.createTextNode('.mdl-layout .mdl-layout__header, .mdl-layout .mdl-layout__drawer-button { color: white; }')
			stylesheet.appendChild(style_text)
			elt.setAttribute('style', f"background: url('{self.background_image}') center / cover;")
			add_class(header, 'mdl-layout__header--transparent')
		elt.appendChild(header)

		header_row = maketag('div', {'class':'mdl-layout__header-row'})
		header.appendChild(header_row)

		def set_title(row):
			if self.title is not None:
				layout_title = maketag('span', {'class':'mdl-layout-title'})
				layout_title.appendChild(doc.createTextNode(self.title))
				row.appendChild(layout_title)

		if self.fixed_drawer:
			add_class(elt, 'mdl-layout--fixed-drawer')
			header_row.appendChild(maketag('div', {'class':'mdl-layout-spacer'}))
			tabs = None
		else:
			set_title(header_row)
			nav = maketag('div', {'class':'mdl-layout__tab-bar mdl-js-ripple-effect mdl-layout__tab-manual-switch'})
			header.appendChild(nav)
			add_class(elt, 'mdl-layout--no-desktop-drawer-button')
			tabs = _set_tabs(nav, 'mdl-layout__tab', self.sections)

		if self.fixed_header:
			add_class(elt, 'mdl-layout--fixed-header')
			add_class(elt, 'mdl-layout--no-drawer-button')
			drawer = None
			links = None
			# add_class(elt, 'mdl-layout--fixed-tabs')
		else:
			drawer = maketag('div', {'class':'mdl-layout__drawer'})
			elt.appendChild(drawer)
			set_title(drawer)
			nav = maketag('nav', {'class':'mdl-navigation'})
			drawer.appendChild(nav)
			links = _set_tabs(nav, 'mdl-navigation__link', self.sections)

		main = maketag('main', {'class':'mdl-layout__content'})
		elt.appendChild(main)
		for section in self.sections:
			section_tag = maketag('section', {'class':'mdl-layout__tab-panel'})
			section.section_tag = section_tag
			main.appendChild(section_tag)
			page_content = maketag('div', {'class':'page-content'})
			section_tag.appendChild(page_content)
			section.render(page_content)

		self.events = _associate_tabs_and_sections(self.sections, tabs, links, drawer)

		if self.footer is not None:
			if self.footer.fixed:
				self.footer.render(elt)
			else:
				self.footer.render(main)
		mdl_upgrade(elt)
		return elt


class Section:
	def __init__(self, name, child=None):
		assert isinstance(name, str)
		assert (child is None) or (hasattr(child, 'render') and callable(child.render))
		self.name = name
		self.child = child
	def render(self, parent):
		elt = maketag('div')
		# elt.innerHTML = f'{self.name} TEST<br>' * 10
		parent.appendChild(elt)
		if self.child is not None:
			self.child.render(elt)
		return elt
	def switch(self, out):
		return True

class Tab:
	def __init__(self, sections=[]):
		assert isinstance(sections, (tuple, list))
		for c in sections:
			assert isinstance(c, Section)
		self.sections = sections
	def render(self, parent):
		elt = maketag('div', {'class':'mdl-tabs mdl-js-tabs mdl-js-ripple-effect'})
		parent.appendChild(elt)
		tab_bar = maketag('div', {'class':'mdl-tabs__tab-bar'})
		elt.appendChild(tab_bar)
		tabs = _set_tabs(tab_bar, 'mdl-tabs__tab', self.sections)
		import random
		tab_id = ''.join(random.sample('abcdefghijklmnopqrstuvwxyz', 16))
		for i, tab in enumerate(tabs):
			tab.setAttribute('href', f'#{tab_id}-{i+1}')
		for i, section in enumerate(self.sections):
			section_tag = maketag('div', {'class':'mdl-tabs__panel', 'id':f'{tab_id}-{i+1}'})
			section.section_tag = section_tag
			elt.appendChild(section_tag)
			section.render(section_tag)
			if i==0:
				add_class(section_tag, 'is-active')
				add_class(tabs[i], 'is-active')
		return elt

# https://getmdl.io/components/index.html#layout-section/footer

class Footer:
	def __init__(self, left=None, right=None, fixed=True, mega=False, 
					middles=[], bottom=None):
		assert (left is None) or isinstance(left, FooterLeft)
		assert (right is None) or isinstance(right, FooterRight)
		assert isinstance(fixed, bool)
		assert isinstance(mega, bool)
		assert isinstance(middles, (tuple, list))
		for c in middles:
			assert isinstance(c, FooterMiddle)
		assert (bottom is None) or isinstance(bottom, FooterBottom)
		assert mega or ((len(middles)==0) and (bottom is None))
		self.left = left
		self.right = right
		self.fixed = fixed
		self.mega = mega
		self.left.mega = mega
		self.right.mega = mega
		self.middles = middles
		self.bottom = bottom
	def render(self, parent):
		size = 'mega' if self.mega else 'mini'
		elt = maketag('footer', {'class':f'mdl-{size}-footer'})
		parent.appendChild(elt)
		if (self.left is not None) or (self.right is not None):
			if self.mega:
				top = maketag('div', {'class':'mdl-mega-footer__top-section'})
				elt.appendChild(top)
			else:
				top = elt
			if self.left is not None:
				self.left.render(top)
			if self.right is not None:
				self.right.render(top)
		if len(self.middles)>0:
			middles = maketag('div', {'class':'mdl-mega-footer__middle-section'})
			elt.appendChild(middles)
			for middle in self.middles:
				middle.render(middles)
		if self.bottom is not None:
			self.bottom.render(elt)
		return elt

def _make_actions(parent, list, tag, cls=None):
	tag = tag.split('-')
	cls = {} if cls is None else {'class':cls}
	for text, action in list.list:
		if tag[0]=='li':
			li = maketag('li')
			parent.appendChild(li)
		else:
			li = parent
		a = maketag(tag[-1], cls)
		li.appendChild(a)
		a.appendChild(doc.createTextNode(text))
		if isinstance(action, str):
			a.setAttribute('href', action)
		else:
			a.bind('click', action)

class FooterLinkList:
	def __init__(self, list=[]):
		for text, action in list:
			assert isinstance(text, str)
			assert isinstance(action, str) or callable(action)
		self.list = list

class FooterLeft:
	def __init__(self, list=None, button=False, title=None, left=True):
		assert (list is None) or isinstance(list, FooterLinkList)
		assert isinstance(button, bool)
		assert (title is None) or isinstance(title, str)
		self.list = list
		self.button = button
		self.title = title
		self.left = left
		self.mega = False
	def render(self, parent):
		size = 'mega' if self.mega else 'mini'
		cls = f'mdl-{size}-footer__left-section' if self.left else f'mdl-{size}-footer__right-section'
		elt = maketag('div', {'class':cls})
		parent.appendChild(elt)
		if self.title is not None:
			div = maketag('div', {'class':'mdl-logo'})
			elt.appendChild(div)
			div.appendChild(doc.createTextNode(self.title))
		if self.mega:
			if self.button:
				_make_actions(elt, self.list, 'button', f'mdl-mega-footer__social-btn')
			else:
				_make_actions(elt, self.list, 'a')
		else:
			if self.list is not None:
				ul = maketag('ul', {'class':'mdl-mini-footer__link-list'})
				elt.appendChild(ul)
				_make_actions(ul, self.list, 'li-a')		
		return elt

class FooterRight(FooterLeft):
	def __init__(self, list=None, button=False, title=None):
		super(FooterRight, self).__init__(list, button, title, False)

class FooterMiddle:
	def __init__(self, title, list):
		assert isinstance(title, str)
		assert isinstance(list, FooterLinkList)
		self.title = title
		self.list = list
	def render(self, parent):
		elt = maketag('div', {'class':'mdl-mega-footer__drop-down-section'})
		parent.appendChild(elt)
		input_tag = maketag('input', {'class':'mdl-mega-footer__heading-checkbox', 'type':'checkbox', 'ckecked':True})
		elt.appendChild(input_tag)
		h1 = maketag('h1', {'class':'mdl-mega-footer__heading'})
		elt.appendChild(h1)
		h1.appendChild(doc.createTextNode(self.title))
		ul = maketag('ul', {'class':'mdl-mega-footer__link-list'})
		elt.appendChild(ul)
		_make_actions(ul, self.list, 'li-a')
		return elt

class FooterBottom:
	def __init__(self, title, list):
		assert isinstance(title, str)
		assert isinstance(list, FooterLinkList)
		self.title = title
		self.list = list
	def render(self, parent):
		elt = maketag('div', {'class':'mdl-mega-footer__bottom-section'})
		parent.appendChild(elt)
		title = maketag('div', {'class':'mdl-logo'})
		elt.appendChild(title)
		title.appendChild(doc.createTextNode(self.title))
		ul = maketag('ul', {'class':'mdl-mega-footer__link-list'})
		elt.appendChild(ul)
		_make_actions(ul, self.list, 'li-a')
		return elt

# https://getmdl.io/components/index.html#layout-section/grid

class Grid:
	def __init__(self, cells=[], 
				large_screen_only=False, small_screen_only=False,
				no_spacing=False, max_width=None):
		assert isinstance(cells, (tuple, list))
		for c in cells:
			assert isinstance(c, GridCell)
		assert isinstance(large_screen_only, bool)
		assert isinstance(small_screen_only, bool)
		assert isinstance(no_spacing, bool)
		assert (max_width is None) or isinstance(max_width, int)
		self.cells = cells
		self.large_screen_only = large_screen_only
		self.small_screen_only = small_screen_only
		self.no_spacing = no_spacing
		self.max_width = max_width
	def render(self, parent):
		style = {'max-width':f'{self.max_width}px', 'margin':'auto'} if self.max_width is not None else None
		elt = maketag('div', {'class':'mdl-grid'}, style)
		if self.large_screen_only:
			add_class(elt, 'mdl-layout--large-screen-only')
		if self.small_screen_only:
			add_class(elt, 'mdl-layout--small-screen-only')
		if self.no_spacing:
			add_class(elt, 'mdl-grid--no-spacing')
		parent.appendChild(elt)
		for c in self.cells:
			c.render(elt)
		return elt

class GridCellAlign:
	def __init__(self, align):
		assert isinstance(align, str)
		self.align = align
	def __repr__(self):
		return self.aligns
	stretch = GridCellAlign('mdl-cell--stretch')
	top = GridCellAlign('mdl-cell--top')
	middle = GridCellAlign('mdl-cell--middle')	
	bottom = GridCellAlign('mdl-cell--bottom')	

class GridCell:
	def __init__(self, child,
				col=None, col_phone=None, col_tablet=None, col_desktop=None, 
				offset=None, offset_phone=None, offset_tablet=None, offset_desktop=None, 
				order=None, order_phone=None, order_tablet=None, order_desktop=None, 
				hidden_phone=False, hidden_tablet=False, hidden_desktop=False,
				align=None, large_screen_only=False, small_screen_only=False):
		assert hasattr(child, 'render') and callable(child.render)
		assert (align is None) or isinstance(align, GridCellAlign)
		assert (col is None) or (isinstance(col, int) and ((1 <= col) and (col <= 12)))
		assert (col_phone is None) or (isinstance(col_phone, int) and ((1 <= col_phone) and (col_phone <= 4)))
		assert (col_tablet is None) or (isinstance(col_tablet, int) and ((1 <= col_tablet) and (col_tablet <= 8)))
		assert (col_desktop is None) or (isinstance(col_desktop, int) and ((1 <= col_desktop) and (col_desktop <= 12)))
		assert (offset is None) or (isinstance(offset, int) and ((1 <= offset) and (offset <= 11)))
		assert (offset_phone is None) or (isinstance(offset_phone, int) and ((1 <= offset_phone) and (offset_phone <= 3)))
		assert (offset_tablet is None) or (isinstance(offset_tablet, int) and ((1 <= offset_tablet) and (offset_tablet <= 7)))
		assert (offset_desktop is None) or (isinstance(offset_desktop, int) and ((1 <= offset_desktop) and (offset_desktop <= 11)))
		assert (order is None) or (isinstance(order, int) and ((1 <= order) and (order <= 12)))
		assert (order_phone is None) or (isinstance(order_phone, int) and ((1 <= order_phone) and (order_phone <= 12)))
		assert (order_tablet is None) or (isinstance(order_tablet, int) and ((1 <= order_tablet) and (order_tablet <= 12)))
		assert (order_desktop is None) or (isinstance(order_desktop, int) and ((1 <= order_desktop) and (order_desktop <= 12)))
		assert isinstance(hidden_phone, bool)
		assert isinstance(hidden_tablet, bool)
		assert isinstance(hidden_desktop, bool)
		assert (align is None) or isinstance(align, GridCellAlign)
		assert isinstance(large_screen_only, bool)
		assert isinstance(small_screen_only, bool)
		self.child = child
		self.col = col
		self.col_phone = col_phone
		self.col_tablet = col_tablet
		self.col_desktop = col_desktop
		self.offset = offset
		self.offset_phone = offset_phone
		self.offset_tablet = offset_tablet
		self.offset_desktop = offset_desktop
		self.order = order
		self.order_phone = order_phone
		self.order_tablet = order_tablet
		self.order_desktop = order_desktop
		self.hidden_phone = hidden_phone
		self.hidden_tablet = hidden_tablet
		self.hidden_desktop = hidden_desktop
		self.large_screen_only = large_screen_only
		self.small_screen_only = small_screen_only
		self.align = align
	def render(self, parent):
		attr = {'class':f'mdl-cell'}
		if self.col is not None:
			attr = {'class':f'mdl-cell mdl-cell--{self.col}-col'}
		elt = maketag('div', attr)
		parent.appendChild(elt)
		if self.col_phone is not None:
			add_class(elt, f'mdl-cell--{self.col_phone}-col-phone')
		if self.col_tablet is not None:
			add_class(elt, f'mdl-cell--{self.col_tablet}-col-tablet')
		if self.col_desktop is not None:
			add_class(elt, f'mdl-cell--{self.col_desktop}-col-desktop')
		if self.offset is not None:
			add_class(elt, f'mdl-cell--{self.offset}-offset')
		if self.offset_phone is not None:
			add_class(elt, f'mdl-cell--{self.offset_phone}-offset-phone')
		if self.offset_tablet is not None:
			add_class(elt, f'mdl-cell--{self.offset_tablet}-offset-tablet')
		if self.offset_desktop is not None:
			add_class(elt, f'mdl-cell--{self.offset_desktop}-offset-desktop')
		if self.order is not None:
			add_class(elt, f'mdl-cell--order-{self.offset}')
		if self.order_phone is not None:
			add_class(elt, f'mdl-cell--order-{self.order_phone}-phone')
		if self.order_tablet is not None:
			add_class(elt, f'mdl-cell--order-{self.order_tablet}-tablet')
		if self.order_desktop is not None:
			add_class(elt, f'mdl-cell--order-{self.order_desktop}-desktop')		
		if self.hidden_phone:
			add_class(elt, 'mdl-cell--hide-phone')
		if self.hidden_tablet:
			add_class(elt, f'mdl-cell--hide-tablet')
		if self.hidden_desktop:
			add_class(elt, f'mdl-cell--hide-desktop')
		if self.align is not None:
			add_class(elt, str(self.align))			
		if self.large_screen_only:
			add_class(elt, 'mdl-layout--large-screen-only')
		if self.small_screen_only:
			add_class(elt, 'mdl-layout--small-screen-only')
		self.child.render(elt)
		return elt


class Center:
	def __init__(self, child):
		assert hasattr(child, 'render') and callable(child.render)
		self.child = child
	def render(self, parent):
		elt = maketag('div', style={'display': 'flex', 'align-items': 'center', 
								'justify-content': 'center', 'width': '100%', 'height': '100%'})
		parent.appendChild(elt)
		child = self.child.render(elt)
		return elt

class EdgeInsets:
	def __init__(self, sizes):
		assert isinstance(sizes, (tuple,list))
		self.sizes = sizes
	def __repr__(self):
		return ' '.join([f'{s}px' if isinstance(s, int) else s for s in self.sizes]) 
	def all(sizes):
		return EdgeInsets([sizes])
	def only(top=0, right=0, bottom=0, left=0):
		return EdgeInsets([top, right, bottom, left])
	def symmetric(horizontal=0, vertical=0):
		return EdgeInsets([vertical, horizontal, vertical, horizontal])

class BorderRadius:
	def __init__(self, sizes):
		assert isinstance(sizes, (tuple,list))
		self.sizes = sizes
	def __repr__(self):
		return ' '.join([f'{s}px' if isinstance(s, int) else s for s in self.sizes]) 
	def all(sizes):
		return BorderRadius([sizes])
	def only(top=0, right=0, bottom=0, left=0):
		return BorderRadius([top, right, bottom, left])

class LinearGradient:
	def __init__(self, degree, colors):
		assert isinstance(degree, (int, str))
		assert isinstance(colors, (tuple,list)) and (len(colors)==2)
		for c in colors:
			assert isinstance(c, str)
		self.degree = degree
		self.colors = colors
	def __repr__(self):
		degree = f'{self.degree}deg' if isinstance(self.degree, int) else self.degree
		return f'linear-gradient({degree}, {self.colors[0]}, {self.colors[1]})'

class Offset:
	def __init__(self, x, y):
		assert isinstance(x, int)
		assert isinstance(y, int)
		self.x = x
		self.y = y

class BoxShadow:
	def __init__(self, color, offset, blurRadius):
		assert isinstance(color, Colors)
		assert isinstance(offset, Offset)
		assert isinstance(blurRadius, int)
		self.color = color
		self.offset = offset
		self.blurRadius = blurRadius
	def __repr__(self):
		x = self.offset.x
		y = self.offset.y
		blurRadius = self.blurRadius
		if isinstance(x, int): x = f'{x}px'
		if isinstance(y, int): y = f'{y}px'
		if isinstance(blurRadius, int): blurRadius = f'{blurRadius}px'
		return f'{x} {y} {blurRadius} {str(self.color)}'

class BoxShape:
	def __init__(self, shape):
		assert isinstance(shape, str)
		self.shape = shape
	def __repr__(self):
		return self.shape
	circle = BoxShape('circle')

class _Box:
	def __init__(self, width=None, height=None, color=None, bg_color=None, 
				borderRadius=None, gradient=None, padding=None, margin=None, 
				boxShadow=None, shape=None):
		assert (width is None) or isinstance(width, (int, str))
		assert (height is None) or isinstance(height, (int, str))
		assert (color is None) or isinstance(color, Colors)
		assert (bg_color is None) or isinstance(bg_color, Colors)
		assert (borderRadius is None) or (isinstance(borderRadius, BorderRadius))
		assert (gradient is None) or (isinstance(gradient, LinearGradient))
		assert (padding is None) or (isinstance(padding, EdgeInsets))
		assert (margin is None) or (isinstance(margin, EdgeInsets))
		if boxShadow is not None:
			assert isinstance(boxShadow, (tuple,list))
			for b in boxShadow:
				assert isinstance(b, BoxShadow)
		assert (shape is None) or isinstance(shape, BoxShape)
		self.width = width
		self.height = height
		self.color = color
		self.bg_color = bg_color
		self.borderRadius = borderRadius
		self.gradient = gradient
		self.padding = padding
		self.margin = margin
		self.boxShadow = boxShadow
		self.shape = shape
	def _style(self):
		style = {}
		if self.width is not None:
			style['width'] = f'{self.width}px' if isinstance(self.width, int) else self.width
		if self.height is not None:
			style['height'] = f'{self.height}px' if isinstance(self.height, int) else self.height
		if self.color is not None:
			style['color'] = str(self.color)
		if self.bg_color is not None:
			style['background-color'] = str(self.bg_color)
		if self.padding is not None:
			style['padding'] = str(self.padding)
		if self.margin is not None:
			style['margin'] = str(self.margin)
		if self.borderRadius is not None:
			style['border-radius'] = str(self.borderRadius)
		if self.gradient is not None:
			style['background'] = str(self.gradient)
		if self.boxShadow is not None:
			style['box-shadow'] = ', '.join([str(b) for b in self.boxShadow])
		if self.shape is not None:
			if self.shape is BoxShape.circle:
				style['border-radius'] = '50%'
		return style

# https://www.cnblogs.com/hellocd/p/10443237.html

class Axis: # flex-direction
	def __init__(self, axis):
		assert isinstance(axis, str)
		self.axis = axis
	def __repr__(self):
		return self.axis
	horizontal = Axis('row')
	vertical = Axis('column')

class MainAxisAlignment: # justify-content
	def __init__(self, align):
		assert isinstance(align, str)
		self.align = align
	def __repr__(self):
		return self.align
	center = MainAxisAlignment('center')
	end = MainAxisAlignment('flex-end')
	spaceAround = MainAxisAlignment('space-around')
	spaceBetween = MainAxisAlignment('space-between')
	spaceEvenly = MainAxisAlignment('space-evenly')
	start = MainAxisAlignment('flex-start')

class CrossAxisAlignment: # align-items
	def __init__(self, align):
		assert isinstance(align, str)
		self.align = align
	def __repr__(self):
		return self.align
	baseline = CrossAxisAlignment('baseline')
	center = CrossAxisAlignment('center')
	end = CrossAxisAlignment('flex-end')
	start = CrossAxisAlignment('flex-start')
	stretch = CrossAxisAlignment('stretch')

class MainAxisSize:
	def __init__(self, size):
		assert isinstance(size, str)
		self.size = size
	def __repr__(self):
		return self.size
	max = MainAxisSize('max')
	min = MainAxisSize('min')

class _Flex:
	def __init__(self, direction=Axis.horizontal, 
			mainAxisAlignment=MainAxisAlignment.start, 
			crossAxisAlignment=CrossAxisAlignment.center, 
			mainAxisSize=MainAxisSize.min,
			):
		assert isinstance(direction, Axis)
		assert isinstance(mainAxisAlignment, MainAxisAlignment)
		assert isinstance(crossAxisAlignment, CrossAxisAlignment)
		assert isinstance(mainAxisSize, MainAxisSize)
		self.direction = direction
		self.mainAxisAlignment = mainAxisAlignment
		self.crossAxisAlignment = crossAxisAlignment
		self.mainAxisSize = mainAxisSize
	def _style(self):
		flex_wrap = 'nowrap'
		if self.direction is Axis.horizontal:
			if self.mainAxisAlignment in (MainAxisAlignment.start, MainAxisAlignment.end):
				flex_wrap = 'wrap'
		style = {'display': 'flex',
				'flex-direction': str(self.direction),
				'flex-wrap': flex_wrap,
				'justify-content':str(self.mainAxisAlignment),
				'align-items':str(self.crossAxisAlignment)}
		if self.mainAxisSize is MainAxisSize.max:
			if self.direction is Axis.horizontal:
				style['width'] = '100%'
			else:
				style['height'] = '100%'
		return style

# containers: Container, Row, Column

class Container(_Box):
	def __init__(self, child, 
			width=None, height=None, color=None, bg_color=None, 
			borderRadius=None, gradient=None, padding=None, margin=None, 
			boxShadow=None, shape=None
			):
		_Box.__init__(self,
						width=width, height=height, color=color, bg_color=bg_color, 
						borderRadius=borderRadius, gradient=gradient, 
						padding=padding, margin=margin, boxShadow=boxShadow, shape=shape
						)
		assert hasattr(child, 'render') and callable(child.render)
		self.child = child
	def render(self, parent):
		style = _Box._style(self)
		if hasattr(self.child, 'textAlign'):
			if self.child.textAlign is not None:
				style['text-align'] = self.child.textAlign
		self.elt = maketag('div', style=style)
		parent.appendChild(self.elt)
		self.child.render(self.elt)
		return self.elt
	def replace_child(self, child):
		assert hasattr(child, 'render') and callable(child.render)
		self.child = child
		clear_elt(self.elt)
		self.child.render(self.elt)
		mdl_upgrade(self.elt)

class Row(_Box, _Flex):
	def __init__(self, *children,
			direction=Axis.horizontal,
			mainAxisAlignment=MainAxisAlignment.start, 
			crossAxisAlignment=CrossAxisAlignment.center, 
			mainAxisSize=MainAxisSize.min,
			width=None, height=None, color=None, bg_color=None, 
			borderRadius=None, gradient=None, padding=None, margin=None, 
			boxShadow=None, shape=None,
			):
		_Box.__init__(self,
						width=width, height=height, color=color, bg_color=bg_color, 
						borderRadius=borderRadius, gradient=gradient, 
						padding=padding, margin=margin, boxShadow=boxShadow, shape=shape,
						)
		_Flex.__init__(self,
						direction=direction,
						mainAxisAlignment=mainAxisAlignment,
						crossAxisAlignment=crossAxisAlignment,
						mainAxisSize=mainAxisSize,
						)
		assert isinstance(children, (tuple,list))
		for child in children:
			assert hasattr(child, 'render') and callable(child.render), type(child).__name__
		self.children = children
	def render(self, parent):
		style = _Box._style(self)
		style.update(_Flex._style(self))
		e = maketag('div', style=style)
		parent.appendChild(e)
		for child in self.children:
			child.render(e)
		return e

class Column(Row):
	def __init__(self, *children,
			mainAxisAlignment=MainAxisAlignment.start, 
			crossAxisAlignment=CrossAxisAlignment.center, 
			mainAxisSize=MainAxisSize.min,
			width=None, height=None, color=None, bg_color=None, 
			borderRadius=None, gradient=None, padding=None, margin=None, 
			boxShadow=None, shape=None,
			):
		Row.__init__(self, *children,
					direction=Axis.vertical,
					mainAxisAlignment=mainAxisAlignment,
					crossAxisAlignment=crossAxisAlignment,
					mainAxisSize=mainAxisSize,
					width=width, height=height, color=color, bg_color=bg_color, 
					borderRadius=borderRadius, gradient=gradient, 
					padding=padding, margin=margin, boxShadow=boxShadow, shape=shape,
					)

# https://getmdl.io/components/index.html#badges-section

class Badge:
	def __init__(self, text, overlap=False, no_background=False):
		assert isinstance(text, str)
		assert isinstance(overlap, bool)
		assert isinstance(no_background, bool)
		self.text = text
		self.overlap = overlap
		self.no_background = no_background

class Text:
	def __init__(self, text, badge=None, href=None, ):
		assert isinstance(text, (str, Icon))
		assert (badge is None) or isinstance(badge, Badge)
		assert (href is None) or isinstance(href, str)
		self.text = text
		self.badge = badge
		self.href = href
	def render(self, parent):
		cls = ''
		attr = {}
		if isinstance(self.text, Icon):
			cls = cls + ' material-icons'
		if self.badge is not None:
			cls = cls + ' mdl-badge'
			if self.badge.overlap:
				cls = cls + ' mdl-badge--overlap'
			if self.badge.no_background:
				cls = cls + ' mdl-badge--no-background'
			attr['data-badge'] = self.badge.text
		attr['class'] = cls	
		if self.href is None:
			elt = maketag('div', attr)
		else:
			attr['href'] = self.href
			elt = maketag('a', attr)
		parent.appendChild(elt)
		if isinstance(self.text, str):
			elt.innerHTML = self.text
		else:
			elt.appendChild(doc.createTextNode(str(self.text)))
		return elt

# https://getmdl.io/components/index.html#buttons-section

class Button:
	def __init__(self, *children, action=None, href=None, ripple_effect=False, 
			disabled=False, raised=False, fab=False, mini_fab=False, 
			accent=False, primary=False, colored=False, icon=False, 
			floating_fixed=False, floating_absolute=False,
			floating_right=26, floating_bottom=26, bg_color=None):
		for c in children:
			assert isinstance(c, (str, Icon))
		assert (action is None) or callable(action)
		assert (href is None) or isinstance(href, str)
		assert (action is None) or (href is None)
		assert isinstance(colored, bool)
		assert isinstance(fab, bool)
		assert isinstance(ripple_effect, bool)
		assert isinstance(disabled, bool)
		assert isinstance(raised, bool)
		assert isinstance(accent, bool)
		assert isinstance(primary, bool)
		assert isinstance(icon, bool)
		assert isinstance(floating_fixed, bool)
		assert isinstance(floating_absolute, bool)
		assert isinstance(floating_right, int)
		assert isinstance(floating_bottom, int)
		assert (bg_color is None) or isinstance(bg_color, str)
		self.children = children
		self.action = action
		self.href = href
		self.colored = colored
		self.fab = fab
		self.mini_fab = mini_fab
		self.ripple_effect = ripple_effect
		self.disabled = disabled
		self.raised = raised
		self.accent = accent
		self.primary = primary
		self.icon = icon
		self.floating_fixed = floating_fixed
		self.floating_absolute = floating_absolute
		self.floating_right = floating_right
		self.floating_bottom = floating_bottom
		self.bg_color = bg_color
	def render(self, parent):
		cls = 'mdl-button mdl-js-button'
		attr = {}
		style = None
		if self.floating_fixed:
			style = {
				'position':'fixed',
				'display': 'block',
				'right': '0',
				'bottom': '0',
				'margin-right': f'{self.floating_right}px',
				'margin-bottom': f'{self.floating_bottom}px',
				'z-index': '900',
			}
		if self.floating_absolute:
			style = {
				'position':'absolute',
				'right': f'{self.floating_right}px',
				'bottom': f'-{self.floating_bottom}px',
				'z-index': '3',
				'z-indebackground': '#64ffda !important',
				'color': 'black !important',
			}
		if self.bg_color is not None:
			style = {'background-color': self.bg_color}
		if self.fab or self.mini_fab:
			cls = cls + ' mdl-button--fab'
		if self.mini_fab:
			cls = cls + ' mdl-button--mini-fab'
		if self.colored:
			cls = cls + ' mdl-button--colored'
		if self.ripple_effect:
			cls = cls + ' mdl-js-ripple-effect'
		if self.raised:
			cls = cls + ' mdl-button--raised'
		if self.accent:
			cls = cls + ' mdl-button--accent mdl-color--accent mdl-color-text--accent-contrast'
		if self.primary:
			cls = cls + ' mdl-button--primary'
		if self.icon:
			cls = cls + ' mdl-button--icon'
		if self.disabled:
			attr['disabled'] = True
		if self.href is not None:
			attr['href'] = self.href
		attr['class'] = cls
		if self.href is None:
			elt = maketag('button', attr, style)
		else:
			elt = maketag('a', attr, style)
		parent.appendChild(elt)
		for c in self.children:
			if isinstance(c, str):
				elt.appendChild(doc.createTextNode(c))
			else:
				icon = maketag('i', {'class':'material-icons'})
				icon.appendChild(doc.createTextNode(str(c)))
				elt.appendChild(icon)
		if self.action is not None:
			elt.bind('click', self.action)
		self.elt = elt
		return elt

# https://getmdl.io/components/index.html#chips-section

class Chip:
	def __init__(self, text, contact=None, image=None, bg_color=None,
				button_chip=False, close_button=False, action=None):
		assert isinstance(text, str)
		assert (bg_color is None) or isinstance(bg_color, str)
		assert (contact is None) or isinstance(contact, str)
		assert (image is None) or isinstance(image, str)
		assert isinstance(close_button, bool)
		assert (action is None) or callable(action)
		self.text = text
		self.bg_color = bg_color
		self.contact = contact
		self.image = image
		self.button_chip = button_chip
		self.close_button = close_button
		self.action = action

	def render(self, parent):
		cls = 'mdl-chip'
		if (self.contact is not None) or (self.image is not None):
			cls = cls + ' mdl-chip--contact'
		if self.close_button:
			cls = cls + ' mdl-chip--deletable'
		attr = {'class':cls}
		style = None
		if self.bg_color is not None:
			style = {'background-color': self.bg_color}
		if self.button_chip:
			attr['type'] = 'button'
			elt = maketag('button', attr, style)
			if self.action is not None:
				elt.bind('click', self.action)
		else:
			elt = maketag('span', attr, style)
		parent.appendChild(elt)
		if self.contact is not None:
			contact = maketag('span', {'class':'mdl-chip__contact mdl-color--teal mdl-color-text--white'}, style)
			elt.appendChild(contact)
			contact.appendChild(doc.createTextNode(self.contact))
		elif self.image is not None:
			image = maketag('img', {'class':'mdl-chip__contact', 'src':self.image}, style)
			elt.appendChild(image)
		text = maketag('span', {'class':'mdl-chip__text'}, style)
		text.appendChild(doc.createTextNode(self.text))
		elt.appendChild(text)
		if self.close_button:
			button = maketag('button', {'type':'button', 'class':'mdl-chip__action'}, style)
			elt.appendChild(button)
			icon = maketag('i', {'class':'material-icons'}, style)
			icon.appendChild(doc.createTextNode('cancel'))
			button.appendChild(icon)
			if self.action is not None:
				button.bind('click', self.action)
		return elt

# https://getmdl.io/components/index.html#dialog-section

class Dialog:
	def __init__(self, content=None, title=None, action=None,
			actions=['Agree', 'Disagree'], 
			actions_full_width=False):
		# assert (content is None) or isinstance(content, str)
		assert (title is None) or isinstance(title, str)
		assert (action is None) or callable(action)
		assert isinstance(actions, (tuple, list))
		for act in actions:
			assert isinstance(act, str)
		assert isinstance(actions_full_width, bool)
		self.content = content
		self.title = title
		self.action = action
		self.actions = actions
		self.actions_full_width = actions_full_width
		self.action_res = None
		self.modal = False
		if self.action is None:
			self.modal = True
			def action_(act):
				self.dialog.close()
				self.action_res = act
			self.action = action_
	def render(self, parent):
		attr = {'class':'mdl-dialog'}
		dialog = maketag('dialog', attr)
		parent.appendChild(dialog)
		dialog_content = maketag('div')
		dialog.appendChild(dialog_content)
		self.h4 = maketag('div')
		dialog_content.appendChild(self.h4)
		self.content_ = maketag('div', {'class':'mdl-dialog__content'})
		dialog_content.appendChild(self.content_)
		cls = 'mdl-dialog__actions'
		if self.actions_full_width:
			cls = cls + ' mdl-dialog__actions--full-width'
		actions = maketag('div', {'class':cls})
		dialog.appendChild(actions)
		def make_action(act):
			def action(ev):
				return self.action(act)
			return action
		for act in self.actions:
			cls = 'mdl-button'
			button = maketag('button', {'type':'button', 'class':cls})
			actions.appendChild(button)
			button.appendChild(doc.createTextNode(act))
			button.bind('click', make_action(act))
		if self.modal:
			def prevent_escape(ev): # 避免escape键关闭对话框
				if hasattr(ev, 'keyCode') and (ev.keyCode.data()==27):
					ev.preventDefault()
			dialog.bind('keydown', prevent_escape)
		self.dialog = dialog
		if not hasattr(self.dialog, 'showModal'):
			javascript.dialogPolyfill.registerDialog(self.dialog)
		self._update_content(self.content, self.title)
		return dialog
	def _update_content(self, content, title):
		clear_elt(self.h4)
		clear_elt(self.content_)
		if title is not None:
			h4 = maketag('h4', {'class':'mdl-dialog__title'})
			h4.appendChild(doc.createTextNode(title))
			self.h4.appendChild(h4)
			mdl_upgrade(self.h4)
		if content is not None:
			if not isinstance(content, (tuple,list)):
				content = [content]
			for c in content:
				assert isinstance(c, str) or (hasattr(c, 'render') and callable(c.render))
				p = maketag('div')
				self.content_.appendChild(p)
				if isinstance(c, str):
					p.appendChild(doc.createTextNode(c))
				else:
					c.render(p)
			mdl_upgrade(self.content_)
		self.action_res = None
	def show(self, content=None, title=None):
		import time
		if content is None:
			content = self.content
		if title is None:
			title = self.title
		self._update_content(content, title)
		self.dialog.showModal()
		if self.modal:
			while self.action_res is None:
				time.sleep(.1)
		return self.action_res
	def close(self):
		self.dialog.close()

# https://getmdl.io/components/index.html#snackbar-section

_toast_elt = None
def toast(message, timeout=2000, action_text=None, action=None):
	global _toast_elt
	if _toast_elt is None:
		_toast_elt = maketag('div', {'class':'mdl-js-snackbar mdl-snackbar'})
		doc.body.appendChild(_toast_elt)
		_toast_elt.appendChild(maketag('div', {'class':'mdl-snackbar__text'}))
		_toast_elt.appendChild(maketag('button', {'class':'mdl-snackbar__action', 'type':'button'}))
		mdl_upgrade(_toast_elt)
	data = {'message':message, 'timeout':timeout}
	if action_text is not None:
		data['actionText'] = action_text
		data['actionHandler'] = action
	_toast_elt.MaterialSnackbar.showSnackbar(data)

# https://getmdl.io/components/index.html#sliders-section

class Slider:
	def __init__(self, min=0, max=100, value=None, 
				step=None, disabled=False, onchange=None):
		assert isinstance(min, int)
		assert isinstance(max, int)
		assert min < max
		assert (value is None) or isinstance(value, int)
		assert (step is None) or isinstance(step, int)
		assert isinstance(disabled, bool)
		assert (onchange is None) or callable(onchange)
		if value is not None:
			assert (min <= value) and (value <= max)
		if step is not None:
			assert (1 <= step) and (step <= (max-min))
		self.min = min
		self.max = max
		self.value = value
		self.step = step
		self.disabled = disabled
		self.onchange = onchange
	def render(self, parent):
		attr = {'class':'mdl-slider mdl-js-slider', 'type':'range',
				'min':f'{self.min}', 'max':f'{self.max}'}
		if self.value is not None:
			attr['value'] = self.value
		if self.step is not None:
			attr['step'] = self.step
		if self.disabled:
			attr['disabled'] = True
		self.elt = maketag('input', attr)
		p = maketag('p', style={'width':'100%'})
		parent.appendChild(p)
		p.appendChild(self.elt)
		mdl_upgrade(p)
		if self.onchange is not None:
			self.elt.bind('change', lambda ev: self.onchange(int(self.elt.value.data())))
		return self.elt
	def change(self, value):
		self.elt.MaterialSlider.change(value)

# https://getmdl.io/components/index.html#loading-section

class Progress:
	def render(self, parent):
		attr = {'class':'mdl-progress mdl-js-progress mdl-progress__indeterminate'}
		self.elt = maketag('div', attr)
		parent.appendChild(self.elt)
		mdl_upgrade(self.elt)
		return self.elt
	def set_progress(self, value):
		remove_class(self.elt, 'mdl-progress__indeterminate')
		self.elt.MaterialProgress.setProgress(value)
	def set_buffer(self, value):
		remove_class(self.elt, 'mdl-progress__indeterminate')
		self.elt.MaterialProgress.setBuffer(value)


# https://getmdl.io/components/index.html#toggles-section

class Checkbox:
	_id = 0
	def __init__(self, text=None, onchange=None, disabled=False, checked=False):
		assert (text is None) or isinstance(text, str)
		assert (onchange is None) or callable(onchange)
		assert isinstance(disabled, bool)
		assert isinstance(checked, bool)
		self.text = text
		self.onchange = onchange
		self.disabled = disabled
		self._checked = checked
	def render(self, parent):
		Checkbox._id = Checkbox._id + 1
		id = f'checkbox_id_{Checkbox._id}'
		attr = {'class':'mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect',
				'for':id}
		elt = maketag('label', attr)
		parent.appendChild(elt)
		attr = {'type':'checkbox', 'id':id, 'class':'mdl-checkbox__input'}
		if self._checked:
			attr['checked']= True
		if self.disabled:
			attr['disabled']= True
		self.input = maketag('input', attr)
		elt.appendChild(self.input)
		if self.onchange is not None:
			def onblur(ev):
				value = self.input.checked.data()
				self.onchange(value)
			self.input.bind('blur', onblur)
		span = maketag('span', {'class':'mdl-checkbox__label'})
		elt.appendChild(span)
		if self.text is not None:
			span.appendChild(doc.createTextNode(self.text))
		return elt

class RadioButton:
	_id = 0
	def __init__(self, name, text=None, onchange=None, disabled=False, checked=False):
		assert (text is None) or isinstance(text, str)
		assert isinstance(name, str)
		assert (onchange is None) or callable(onchange)
		assert isinstance(disabled, bool)
		assert isinstance(checked, bool)
		self.text = text
		self.name = name
		self.onchange = onchange
		self.disabled = disabled
		self._checked = checked
	def render(self, parent):
		RadioButton._id = RadioButton._id + 1
		id = f'radio_button_id_{RadioButton._id}'
		attr = {'class':'mdl-radio mdl-js-radio mdl-js-ripple-effect',
				'for':id}
		elt = maketag('label', attr)
		parent.appendChild(elt)
		attr = {'type':'radio', 'id':id, 'class':'mdl-radio__button', 'name':self.name}
		if self._checked:
			attr['checked']= True
		if self.disabled:
			attr['disabled']= True
		self.input = maketag('input', attr)
		elt.appendChild(self.input)
		if self.onchange is not None:
			def onblur(ev):
				self.onchange(self.text)
			self.input.bind('blur', onblur)
		span = maketag('span', {'class':'mdl-checkbox__label'})
		elt.appendChild(span)
		if self.text is not None:
			span.appendChild(doc.createTextNode(self.text))
		return elt

class Switch:
	_id = 0
	def __init__(self, text=None, onchange=None, disabled=False, checked=False):
		assert (text is None) or isinstance(text, str)
		assert (onchange is None) or callable(onchange)
		assert isinstance(disabled, bool)
		assert isinstance(checked, bool)
		self.text = text
		self.onchange = onchange
		self.disabled = disabled
		self._checked = checked
	def render(self, parent):
		Switch._id = Switch._id + 1
		id = f'switch_id_{Switch._id}'
		attr = {'class':'mdl-switch mdl-js-switch mdl-js-ripple-effect',
				'for':id}
		elt = maketag('label', attr)
		parent.appendChild(elt)
		attr = {'type':'checkbox', 'id':id, 'class':'mdl-switch__input'}
		if self._checked:
			attr['checked']= True
		if self.disabled:
			attr['disabled']= True
		self.input = maketag('input', attr)
		elt.appendChild(self.input)
		if self.onchange is not None:
			def onblur(ev):
				value = self.input.checked.data()
				self.onchange(value)
			self.input.bind('blur', onblur)
		span = maketag('span', {'class':'mdl-switch__label'})
		elt.appendChild(span)
		if self.text is not None:
			span.appendChild(doc.createTextNode(self.text))
		return elt

class IconToggle:
	_id = 0
	def __init__(self, icon=None, onchange=None, disabled=False, checked=False):
		assert isinstance(icon, Icon)
		assert (onchange is None) or callable(onchange)
		assert isinstance(disabled, bool)
		assert isinstance(checked, bool)
		self.icon = icon
		self.onchange = onchange
		self.disabled = disabled
		self._checked = checked
	def render(self, parent):
		IconToggle._id = IconToggle._id + 1
		id = f'icon_toggle_id_{IconToggle._id}'
		attr = {'class':'mdl-icon-toggle mdl-js-icon-toggle mdl-js-ripple-effect',
				'for':id}
		elt = maketag('label', attr)
		parent.appendChild(elt)
		attr = {'type':'checkbox', 'id':id, 'class':'mdl-icon-toggle__input'}
		if self._checked:
			attr['checked']= True
		if self.disabled:
			attr['disabled']= True
		self.input = maketag('input', attr)
		elt.appendChild(self.input)
		if self.onchange is not None:
			def onblur(ev):
				value = self.input.checked.data()
				self.onchange(value)
			self.input.bind('blur', onblur)
		span = maketag('i', {'class':'mdl-icon-toggle__label material-icons'})
		elt.appendChild(span)
		span.appendChild(doc.createTextNode(str(self.icon)))
		return elt

class Textfield:
	_id = 0
	def __init__(self, value='', label=None, onchange=None, disabled=False,
				pattern=None, error=None, floating_label=False,
				rows=None, maxrows=None, width=None):
		assert isinstance(value, str)
		assert (label is None) or isinstance(label, str)
		assert (onchange is None) or callable(onchange)
		assert isinstance(disabled, bool)
		assert (pattern is None) or isinstance(pattern, str)
		assert (error is None) or isinstance(error, str)
		assert isinstance(floating_label, bool)
		assert (rows is None) or isinstance(rows, int)
		assert (maxrows is None) or isinstance(maxrows, int)
		assert (width is None) or isinstance(width, (int,str))
		self._value = value
		self.label = label
		self.onchange = onchange
		self.disabled = disabled
		self.pattern = pattern
		self.error = error
		self.floating_label = floating_label
		self.rows = rows
		self.maxrows = maxrows
		self.width = width
	def value(self, value=None):
		if value is not None:
			self.input.value = value
		else:
			return self.input.value.data()
	def render(self, parent):
		Textfield._id = Textfield._id + 1
		id = f'textfield_id_{Textfield._id}'
		attr = {'class':'mdl-textfield mdl-js-textfield'}
		if self.floating_label:
			attr['class']= attr['class']+' mdl-textfield--floating-label'
		style = {}
		if self.width is not None:
			style['width'] = f'{self.width}px' if isinstance(self.width, int) else self.width
		elt = maketag('div', attr, style)
		parent.appendChild(elt)
		attr = {'type':'text', 'id':id, 'class':'mdl-textfield__input',
				'value':self._value}
		if self.rows is not None:
			attr['rows']= self.rows
		if self.maxrows is not None:
			attr['maxrows']= self.maxrows
		if self.disabled:
			attr['disabled']= True
		if self.pattern is not None:
			attr['pattern']= self.pattern
		self.input = maketag('input' if self.rows is None else 'textarea', attr)
		elt.appendChild(self.input)
		if self.onchange is not None:
			def onblur(ev):
				value = self.input.value.data()
				self.onchange(value)
			self.input.bind('blur', onblur)
		span = maketag('label', {'class':'mdl-textfield__label','for':id})
		elt.appendChild(span)
		span.appendChild(doc.createTextNode(self.label))
		if self.error is not None:
			span = maketag('span', {'class':'mdl-textfield__error'})
			elt.appendChild(span)
			span.appendChild(doc.createTextNode(self.error))
		return elt

# https://getmdl.io/components/index.html#lists-section

class ListItem:
	def __init__(self, text, sub_title=None, text_body=None,
				icon=None, avatar=None, action=None):
		assert isinstance(text, str)
		assert (sub_title is None) or isinstance(sub_title, str)
		assert (text_body is None) or isinstance(text_body, str)
		assert (icon is None) or isinstance(icon, Icon)
		assert (avatar is None) or isinstance(avatar, Icon)
		assert (icon is None) or (avatar is None)
		assert (action is None) or (hasattr(action,'render') and callable(action.render))
		self.text = text
		self.sub_title = sub_title
		self.text_body = text_body
		self.icon = icon
		self.avatar = avatar
		self.action = action

class List:
	def __init__(self, *items):
		for item in items:
			assert isinstance(item, ListItem)
		self.items = items
	def render(self, parent):
		attr = {'class':'mdl-list'}
		style = {'width':'100%', 'background-color':'white'}
		elt = maketag('ul', attr, style)
		parent.appendChild(elt)
		for item in self.items:
			attr = {'class':'mdl-list__item'}
			if item.sub_title is not None:
				attr['class'] = 'mdl-list__item mdl-list__item--two-line'
			if item.text_body is not None:
				attr['class'] = 'mdl-list__item mdl-list__item--three-line'
			li = maketag('li', attr)
			elt.appendChild(li)
			span = maketag('span', {'class':'mdl-list__item-primary-content'})
			li.appendChild(span)
			if item.icon is not None:
				i = maketag('i', {'class':'material-icons mdl-list__item-icon'})
				span.appendChild(i)
				i.appendChild(doc.createTextNode(str(item.icon)))
			if item.avatar is not None:
				i = maketag('i', {'class':'material-icons mdl-list__item-avatar'})
				span.appendChild(i)
				i.appendChild(doc.createTextNode(str(item.avatar)))
			span.appendChild(doc.createTextNode(item.text))
			if item.sub_title is not None:
				sub_title = maketag('span', {'class':'mdl-list__item-sub-title'})
				span.appendChild(sub_title)
				sub_title.appendChild(doc.createTextNode(item.sub_title))
			if item.text_body is not None:
				text_body = maketag('span', {'class':'mdl-list__item-text-body'})
				span.appendChild(text_body)
				text_body.appendChild(doc.createTextNode(item.text_body))
			if item.action is not None:
				span = maketag('span', {'class':'mdl-list__item-secondary-action'})
				li.appendChild(span)
				item.action.render(span)
		return elt

# https://getmdl.io/components/index.html#menus-section

class Menu:
	_id = 0
	def __init__(self, icon, items, text=None, onchange=None, color=None):
		assert isinstance(icon, Icon)
		assert isinstance(items, (tuple, list))
		assert (text is None) or isinstance(text, str)
		assert (onchange is None) or callable(onchange)
		assert (color is None) or sinstance(color, Colors)
		self.icon = icon
		for item in items:
			assert isinstance(item, str)
		self.items = items
		self.text = text
		self.onchange = onchange
		self.color = color
	def render(self, parent):
		elt = maketag('span', style={'position':'relative'})
		parent.appendChild(elt)
		Menu._id = Menu._id + 1
		id = f'menu_id_{Menu._id}'
		# attr = {'id':id, 'class':'mdl-button mdl-js-button mdl-button--icon'}
		style = {'text-decoration':'none', 'color':'#767777', 'display':'flex'}
		if self.color is not None:
			style['color'] = str(self.color)
		btn = maketag('a', {'id':id}, style)
		elt.appendChild(btn)
		if self.text is not None:
			text = maketag('span')
			btn.appendChild(text)
			text.innerHTML = self.text
		icon = maketag('i', {'class':'material-icons'})
		btn.appendChild(icon)
		icon.appendChild(doc.createTextNode(str(self.icon)))
		attr = {'class':'mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect',
				'data-mdl-for':id}
		ul = maketag('ul', attr)
		elt.appendChild(ul)
		attr = {'class':'mdl-menu__item'}
		def callback_closure(item):
			def callback(ev):
				if self.text is not None:
					text.innerHTML = item
				self.onchange(item)
			return callback
		for item in self.items:
			li = maketag('li', attr)
			ul.appendChild(li)
			li.appendChild(doc.createTextNode(item))
			li.bind('click', callback_closure(item))
		return btn

class Dropdown:
	def __init__(self, items, value=None, textfield=None, onchange=None):
		assert isinstance(items, (tuple, list))
		for item in items:
			assert isinstance(item, str)
		assert (value is None) or isinstance(value, str)
		assert (onchange is None) or callable(onchange)
		assert (textfield is None) or isinstance(textfield, Textfield)
		self.items = items
		self.value = value
		self.textfield = textfield
		self.onchange = onchange
	def render(self, parent):
		elt = maketag('div', style={'display':'flex'})
		parent.appendChild(elt)
		if self.textfield is not None:
			textfield_elt = self.textfield.render(elt)
			textfield_elt.style['padding']='0px'
			if self.value is not None:
				self.textfield.value(self.value)
			value = None
		else:
			value = '' if self.value is None else self.value
		def menu_onchange(value):
			if self.textfield is not None:
				self.textfield.value(value)
			if self.onchange is not None:
				self.onchange(value)
		menu = Menu(Icon('arrow_drop_down'), self.items, value, menu_onchange)
		menu.render(elt)
		return elt

# https://getmdl.io/components/index.html#tables-section

class Table:
	def __init__(self, head, rows, editable=False, shadow=3, onchange=None):
		assert isinstance(head, (tuple, list))
		for c in head:
			assert isinstance(c, str)
		assert isinstance(rows, (tuple, list))
		for r in rows:
			assert isinstance(r, (tuple, list))
			for c in r:
				assert isinstance(c, (int, float, str, bool))
		assert isinstance(editable, bool)
		assert isinstance(shadow, int)
		assert (onchange is None) or callable(onchange)
		self.head = head
		self.rows = rows
		self.editable = editable
		self.shadow = shadow
		self.onchange = onchange
	def render(self, parent):
		attr = {'class':f'mdl-data-table mdc-data-table__table-container mdl-js-data-table mdl-shadow--{self.shadow}dp'}
		elt = maketag('table', attr)
		parent.appendChild(elt)
		thead = maketag('thead')
		elt.appendChild(thead)
		tr = maketag('tr')
		thead.appendChild(tr)
		for c in self.head:
			th = maketag('th', {'class':'mdl-data-table__cell--non-numeric'})
			tr.appendChild(th)
			th.appendChild(doc.createTextNode(c))
		tbody = maketag('tbody')
		elt.appendChild(tbody)
		for r,row in enumerate(self.rows):
			tr = maketag('tr')
			tbody.appendChild(tr)
			for c,col in enumerate(row):
				td = maketag('td', {'class':'mdl-data-table__cell--non-numeric'})
				tr.appendChild(td)
				if self.editable:
					def onchange(r,c,row):
						def callback(value):
							value0 = row[c]
							row[c] = value
							if value0==value: return
							if self.onchange is None: return
							self.onchange(r,c,value0,value)
						return callback
					textfield = Textfield(str(col), width='100%', onchange=onchange(r,c,row))
					textfield_elt = textfield.render(td)
					textfield_elt.style['padding']='0px'
				else:
					td.appendChild(doc.createTextNode(str(col)))
		return elt

# additional

class Image:
	def __init__(self, src, width=None, height=None, lazy_loading=False):
		assert isinstance(src, str)
		assert (width is None) or isinstance(width, (int,str))
		assert (height is None) or isinstance(height, (int,str))
		assert (lazy_loading is None) or isinstance(lazy_loading, bool)
		self.src = src
		self.width = width
		self.height = height
		self.lazy_loading = lazy_loading
	def render(self, parent):
		attr = {'src':self.src}
		if self.width is not None:
			attr['width'] = self.width
		if self.height is not None:
			attr['height'] = self.height
		if self.lazy_loading is not None:
			attr['loading'] = 'lazy'
		elt = maketag('img', attr)
		parent.appendChild(elt)
		return elt

