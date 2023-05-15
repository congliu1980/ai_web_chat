
js = javascript
doc = js.document

from mdl_ import tools 
maketag = tools.maketag
add_class = tools.add_class
has_class = tools.has_class
remove_class = tools.remove_class
mdl_upgrade = tools.mdl_upgrade

_portfolio_css = '''
.mdl-layout__header {
	min-height:43px;
}

.portfolio-header {
	position: relative;
	background-image: url($header-bg);
}

.portfolio-header .mdl-layout__header-row {
	color: black;
	padding: 0;
	-webkit-justify-content: center;
			-ms-flex-pack: center;
					justify-content: center;
}

.mdl-layout__title {
	font-size: 36px;
	text-align: center;
	font-weight: 500;
	color: #CC0000;
}

.is-compact .mdl-layout__title span {
	display: none;
}

.portfolio-logo-row {
	min-height: 200px;
}

.is-compact .portfolio-logo-row {
	# min-height: auto;
	display: none;
}

.portfolio-logo {
	$logo
	background-size: cover;
	height: 94px;
	width: 350px;
	margin: auto auto 10px;
}

# .is-compact .portfolio-logo {
# 	/*display: none;*/
# 	height: 50px;
# 	width: 50px;
# 	margin-top: 7px;
# }

.portfolio-navigation-row {
	background-color: rgba(0, 0, 0, 0.08);
	text-transform: uppercase;
	height: 45px;
}

.portfolio-navigation-row .mdl-navigation {
	text-align: center;
	max-width: 900px;
	width: 100%;
}

.portfolio-navigation-row .mdl-navigation__link {
	-webkit-flex: 1;
			-ms-flex: 1;
					flex: 1;
	line-height: 42px;
	color: black;
	position: relative;
}

.portfolio-header .mdl-layout__drawer-button {
	color: black;
	background-color: rgba(197, 197, 197, 0.44);
	line-height:44px;
	height:36px; width:36px;
}

.portfolio-navigation-row .is-active {
	position: relative;
	font-weight: bold;
}

.portfolio-navigation-row .is-active:after {
	content: "";
	width: 70%;
	height: 2px;
	display: block;
	position: absolute;
	bottom: 0;
	left: 0;
	background-color: rgb(255,64,129);
	left: 15%;
}
'''

class PortfolioApp:
	def __init__(self, 
				title=None,
				app_icon=None,
				logo=None,
				header_bg=None,
				sections=[],
				footer=None,
				):
		assert (title is None) or isinstance(title, str)
		assert (app_icon is None) or isinstance(app_icon, str)
		assert (logo is None) or isinstance(logo, str)
		assert isinstance(header_bg, str)
		assert isinstance(sections, (tuple, list))
		for c in sections:
			assert type(c).__name__=='Section'
		assert (footer is None) or (type(footer).__name__=='Footer')
		self.title = title
		self.app_icon = app_icon
		self.logo = logo
		self.header_bg = header_bg
		self.sections = sections
		self.footer = footer

	def render(self, parent):
		stylesheet = doc.createElement('style')
		doc.head.appendChild(stylesheet)
		portfolio_css = _portfolio_css
		if self.logo is None:
			portfolio_css = portfolio_css.replace('$logo', '')
		else:
			logo = f'background: url({self.logo}) 50% no-repeat;'
			portfolio_css = portfolio_css.replace('$logo', logo)
		portfolio_css = portfolio_css.replace('$header-bg', self.header_bg)
		portfolio_css = doc.createTextNode(portfolio_css)
		stylesheet.appendChild(portfolio_css)
		if self.title is not None:
			doc.title = self.title
		if self.app_icon is not None:
			link = doc.querySelector("link[rel*='icon']")
			link.href = self.app_icon
		elt = maketag('div', {'class':'mdl-layout mdl-js-layout mdl-layout--fixed-header'})
		parent.appendChild(elt)
		attr = {'class':'mdl-layout__header portfolio-header mdl-layout__header--waterfall'}
		header = maketag('header', attr)
		elt.appendChild(header)
		attr = {'class':'mdl-layout__header-row portfolio-logo-row'}
		header_row = maketag('div', attr)
		header.appendChild(header_row)
		title = maketag('span', {'class':'mdl-layout__title'})
		header_row.appendChild(title)
		logo = maketag('div', {'class':'portfolio-logo'})
		title.appendChild(logo)
		title_text = maketag('span', {'class':'mdl-layout__title'})
		title.appendChild(title_text)
		title_text.appendChild(doc.createTextNode(self.title))
		attr = {'class':'mdl-layout__header-row portfolio-navigation-row mdl-layout--large-screen-only'}
		header_row = maketag('div', attr)
		header.appendChild(header_row)

		def set_tabs(bar, cls):
			tabs = []
			for section in self.sections:
				tab = maketag('a', {'class':cls})
				bar.appendChild(tab)
				tab.appendChild(doc.createTextNode(section.name))
				tabs.append(tab)
			return tabs

		def associate_tabs_and_sections(tabs, links, drawer):
			cur_section = None
			class Action_:
				def __init__(self, section, drawer):
					self.section = section
					self.drawer = drawer
				def onclick(self, ev=None):
					if has_class(self.drawer, 'is-visible'):
						doc.querySelector('.mdl-layout').MaterialLayout.toggleDrawer()
					nonlocal cur_section
					if not cur_section.switch(True): return
					if not self.section.switch(False): return
					remove_class(cur_section.section, 'is-active')
					remove_class(cur_section.tab, 'is-active')
					cur_section = self.section
					add_class(cur_section.section, 'is-active')
					add_class(cur_section.tab, 'is-active')
			actions = []
			for i, (section, tab, link) in enumerate(zip(self.sections, tabs, links)):
				section.tab = tab
				if i == 0:
					cur_section = section
					add_class(section.section, 'is-active')
					add_class(tab, 'is-active')
				action = Action_(section, drawer).onclick
				actions.append(action)
				tab.bind('click', action)
				link.bind('click', action)
			return actions

		nav = maketag('nav', {'class':'mdl-navigation'})
		header_row.appendChild(nav)
		tabs = set_tabs(nav, 'mdl-navigation__link mdl-js-button mdl-js-ripple-effect')

		drawer = maketag('div', {'class':'mdl-layout__drawer mdl-layout--small-screen-only'})
		elt.appendChild(drawer)
		nav = maketag('nav', {'class':'mdl-navigation'})
		drawer.appendChild(nav)
		links = set_tabs(nav, 'mdl-navigation__link')

		main = maketag('main', {'class':'mdl-layout__content'})
		elt.appendChild(main)
		for section in self.sections:
			section.section = maketag('section', {'class':'mdl-layout__tab-panel'})
			main.appendChild(section.section)
			page_content = maketag('div', {'class':'page-content'})
			section.section.appendChild(page_content)
			section.render(page_content)

		self._goto_section = associate_tabs_and_sections(tabs, links, drawer)
		self.footer.render(main)
		
		mdl_upgrade(elt)
		return elt

	def get_goto_section(self, index):
		self._goto_section[index]()
		

