
# https://getmdl.io/customize/index.html

class Themes:
	def apply(self):
		doc = javascript.document
		link = doc.querySelector("link#material_css[rel*='stylesheet']")
		link.href = f'/web/lib/mdl/css/material.{self.primary}-{self.accent}.min.css'

	def __init__(self, primary, accent):
		self.primary = primary
		self.accent = accent
	def __repr__(self):
		return f'material.{self.primary}-{self.accent}.min.css'

