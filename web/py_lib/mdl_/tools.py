
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

def has_class(elt, clazz):
	cls = elt.getAttribute('class').data()
	cls = set() if cls is None else set(cls.split())
	return clazz in cls

def add_class(elt, *classes):
	cls = elt.getAttribute('class').data()
	cls = set() if cls is None else set(cls.split())
	for c in classes:
		cls.add(c)
	elt.setAttribute('class', ' '.join(cls))

def remove_class(elt, *classes):
	cls = elt.getAttribute('class').data()
	cls = set() if cls is None else set(cls.split())
	for c in classes:
		if c in cls:
			cls.remove(c)
	elt.setAttribute('class', ' '.join(cls))

def mdl_upgrade(elt):
	js.componentHandler.upgradeElement(elt)
	for i in range(elt.children.length.data()):
		mdl_upgrade(elt.children[i])

def clear_elt(elt):
	while elt.children.length.data() > 0:
		elt.lastChild.remove()
