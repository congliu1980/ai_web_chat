
def _argb(c):
	t = '0123456789abcdef'
	m = {t1:i for i,t1 in enumerate(list(t))}
	m.update({t1:i for i,t1 in enumerate(list(t.upper()))})
	def dc(c1,c2):
		c12 = (m[c1]*16)+m[c2]
		return c12
	assert isinstance(c, str) and (len(c)==8)
	c = [dc(c[2*i],c[(2*i)+1]) for i in range(4)]
	c = c[1:]+[round(c[0]/2.56)/100]
	c = [str(c1) for c1 in c]
	return f'rgba({",".join(c)})'

class Colors:
	def __init__(self, color):
		assert isinstance(color, str)
		self.color = color
	def __repr__(self):
		return self.color
	def opacity(self, o):
		if self.color[0]=='#':
			o = int(o*255)
			o1, o2 = o//16, o%16
			t = '0123456789abcdef'
			o = t[o1] + t[o2]
			o = o + self.color[1:]
			c = _argb(o)
		elif self.color.startswith('rgba'):
			c = self.color.split(',')[:-1]
			c.append(f'{o})')
			c = ','.join(c)
		return Colors(c)
	def argb(c):
		return Colors(_argb(c))

	C = Colors
	black =	 C.argb('FF000000')
	white =	 C.argb('FFFFFFFF')
