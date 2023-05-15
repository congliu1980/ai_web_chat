
class Icon:
	def __init__(self, icon):
		assert isinstance(icon, str)
		self.icon = icon
	def __repr__(self):
		return self.icon
