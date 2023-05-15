
function create_jswrt() {
function _copy_span_info(to, from) {
	to.original = from
}
function _copy_info(s, span) {
	if (s instanceof Span)
		_copy_span_info(s, span)
	else
		_copy_info(s.span, span)
	for (let c of s.children)
		_copy_info(c, span)
}
function parse_exp(source, type, span) {
	let spans = lex.match(source, source)
	let lex_lines = split_lex_lines(spans)
	let line = []
	for (let l of lex_lines) {
		line = line.concat(l)
	}
	let tree = parser.reduce(line, t=>t==type)
	_copy_info(tree, span)
	simplify_exps(tree)
	return tree
}
function parse_lines(source, span) {
	let spans = lex.match(source, source)
	let lex_lines = split_lex_lines(spans)
	let line_trees = []
	for (let line of lex_lines) {
		let tree = parser.reduce(line, null)
		simplify_exps(tree)
		line_trees.push(tree)
	}
	line_trees = tree_reduce(line_trees, false) 
	for (let tree of line_trees) {
		_copy_info(tree, span)
	}
	return line_trees
}
function parse(source, file_nm) {
	let spans = lex.match(source, file_nm)
	let lex_lines = split_lex_lines(spans)
	let line_trees = []
	for (let line of lex_lines) {
		let tree = parser.reduce(line, null)
		simplify_exps(tree)
		line_trees.push(tree)
	}
	return tree_reduce(line_trees, true) 
}
function __print_tree(sl, indent, tab) {
	let repr = ''
	if (sl instanceof Span) {
		if (sl.children.length == 0) { 
			return indent+sl.type+' '+sl.text+'    ('+(sl.line_no+1)+':'+(sl.char_start+1)+'-'+(sl.char_end+1)+')\n'
		}
		else {
			repr += indent+sl.rule_key+'    ('+(sl.line_no+1)+':'+(sl.char_start+1)+'-'+(sl.char_end+1)+')\n'
			for (let c of sl.children) {
				if (c.parent != sl) console.log('wrong parent', c, sl)
				repr += __print_tree(c, indent+tab, tab)
			}
			return repr
		}
	}
	if (sl instanceof Line) {
		if (sl.span!=undefined)
			repr += __print_tree(sl.span, indent, tab)
		for (let c of sl.children) {
			if (c.parent != sl) console.log('wrong parent', c, sl)
			repr += __print_tree(c ,indent+tab, tab)
		}
		return repr
	}
	console.error(sl)
	throw new Error('Not Span or Line')
}
function _print_trees(trees, tab) {
	if (tab===undefined) tab='  '
	repr = ''
	for (let tree of trees)
		repr += __print_tree(tree, '', tab)+'\n'
	return repr
}
function __print_program(sl, indent, tab) {
	let repr = ''
	if (sl instanceof Span) {
		if (sl.children.length == 0)
			return sl.text
		else {
			let sep=''
			if (sl.type.indexOf('+')!=-1)
				sep = sl.type.substring(sl.type.lastIndexOf('+')+1)
			let d = []
			for (let c of sl.children) {
				d.push(__print_program(c, indent, tab))
			}
			return repr+d.join(sep+' ')
		}
	}
	if (sl instanceof Line) {
		if (sl.span!==undefined)
			repr += indent+__print_program(sl.span, indent, tab)+'\n'
		for (let c of sl.children)
			repr += __print_program(c ,indent+tab, tab)
		return repr
	}
	throw new Error('Unhandled obj:'+sl.constructor.name)
}
function _print_program(trees, tab) {
	if (tab===undefined) tab='  '
	repr = ''
	for (let tree of trees)
		repr += __print_program(tree, '', tab)
	return repr
}
function _read_ids(sl) {
	if (sl instanceof Line) {
		if (sl.span !== undefined)
			_read_ids(sl.span)
	}
	else {
		if (sl.type == '$id')
			_temp_ids.add(sl.text)
	}
	for (let c of sl.children)
		_read_ids(c)
}
function _copy_before_convert(sl, parent) {
	let cpy = sl.copy()
	cpy.parent = parent
	cpy.original = sl
	if (sl.span !== undefined)
		cpy.span = _copy_before_convert(sl.span, cpy)
	for (let c of sl.children)
		cpy.children.push(_copy_before_convert(c, cpy))
	return cpy
}
function convert(sl) {
	if (sl instanceof Line) {
		if (sl.span !== undefined)
			convert(sl.span)
	}
	else {
		if (parser.rules.has(sl.rule_key)) {
			let rule = parser.rules.get(sl.rule_key)
			if (rule.action != null)
				return rule.action(sl)
		}
	}
	let children = [...sl.children]
	for (let c of children)
		if (c.parent == sl)
			convert(c)
}
function _convert_arrows(sl) {
	if (sl == null) return
	if (sl instanceof Span) {
		if (sl.rule_key != null)
			sl.rule_key = sl.rule_key.replace('<-','->')
	}
	else
		_convert_arrows(sl.span)
	for (let c of sl.children)
		_convert_arrows(c)
}
function copy_convert(sl) {
	sl = _copy_before_convert(sl, null)
	convert(sl)
	_convert_arrows(sl)
	return sl
}
function action(sl) {
	if (sl instanceof Span) {
		if (sl.children.length == 0) 
			return sl.text
		else if (parser.rules.has(sl.rule_key) || (sl.type[0]!="'" && sl.type.indexOf('+')!=-1)) {
			if (parser.rules.has(sl.rule_key)) {
				let rule = parser.rules.get(sl.rule_key)
				if (rule.action != null)
					return rule.action(sl)
			}
			let res = []
			for (let c of sl.children)
				res.push(action(c))
			if (res.length == 1) return res[0]
			return res
		}
	}
	if (sl instanceof Line) {
		let tree_action = tree.rules.get(sl.span.type)
		if (tree_action != null) return tree_action(sl)
		tree_format_assert(sl, sl.children.length == 0, 'No block should follow '+sl.span.type)
		return action(sl.span)
	}
	throw new Error('Unhandled rule: '+ (sl instanceof Line ? sl.span.type: sl.rule_key) )
}
function norm_text_1(t) {
	return t.replace('(', '-LRB-').replace(')', '-RRB-')
}
class Span
{
	constructor(file_nm, line_no, prev_end, char_start, char_end, type, text) {
		this.file_nm = file_nm 
		this.line_no = line_no 
		this.prev_end = prev_end 
		this.char_start = char_start 
		this.char_end = char_end 
		this.type = type 
		this.text = text 
		this.parent = null 
		this.children = [] 
		this.order = null 
		this.prev_order = null 
		this.rule_key = null 
		this.original = null 
	}
	copy() {
		let s = new Span(this.file_nm, this.line_no, this.prev_end,
			this.char_start, this.char_end, this.type, this.text)
		s.order = this.order
		s.prev_order = this.prev_order
		s.rule_key = this.rule_key
		return s
	}
	key() {
		return this.type+'('+ (this.prev_order+1)+','+this.order+')'
	}
	linearize() {
		if (this.children.length == 0)
			return '('+norm_text_1(this.type)+" "+norm_text_1(this.text)+')'
		let repr = '('+norm_text_1(this.type)
		for (let c of this.children)
			repr += ' '+c.linearize()
		return repr+')'
	}
	__get_text() {
		if (this.children == 0) {
			let repr = ''
			for (let i = this.prev_end; i < this.char_start; ++ i)
				repr += ' '
			return repr+this.text
		}
		let repr = []
		for (let c of this.children) {
			repr.push(c.__get_text())
		}
		let ri = this.type.lastIndexOf('+')
		let mark = ''
		if (this.type[0]!="'" && ri != -1) {
			mark = this.type.substring(ri+1)
		}
		let text = (repr.length>0 ? repr[0]: '')
		for (let i = 1; i < repr.length; ++ i) {
			if (mark!='' && repr[i][0]==' ')
				text += mark + repr[i].substring(1)
			else
				text += mark + repr[i]
		}
		return text
	}
	get_text() {
		return this.__get_text().trim()
	}
}
class TextMatcher
{
	constructor(type, text) {
		this.type = type
		this.text = text
	}
	match(line, start) {
		let word = line.substring(start, start+this.text.length)
		return (word == this.text) ? this.text.length : 0
	}
}
class SymbolMatcher
{
	constructor(type, func) {
		this.type = type
		this.func = func
	}
	match(line, start) {
		return this.func(line, start)
	}
}
class LexicalError extends Error {
	constructor(span, err_msg) {
		super(err_msg)
		this.span = span
	}
}
function _report_lex_error(msg, file_nm, line_no, char_no, text) {
	let span = new Span(file_nm, line_no, null, char_no, char_no+text.length, null, text)
	throw new LexicalError(span, msg)
}
class Lex
{
	constructor() {
		this.matchers = []
	}
	match(file, file_nm) {
		let line_no = 0
		let char_no = 0
		let spans = []
		let prev_end = 0
		for (let i = 0; i < file.length; ++ i) {
			if (file[i] == ' ' || file[i] == '\t' || file[i] == '\r') {
				++ char_no
				continue
			}
			if (file[i] == '\n') {
				++ line_no
				prev_end = 0
				char_no = 0
				continue
			}
			let max_match_size = -1
			let match_type
			for (let matcher of this.matchers) {
				let match_size = matcher.match(file, i)
				if (match_size > 0 && match_size > max_match_size) {
					max_match_size = match_size
					match_type = matcher.type
				}
			}
			if (max_match_size == -1) {
				let err_text = file.substring(i).split('\n')[0]
				_report_lex_error(err_text, file_nm, line_no, char_no, err_text)
			}
			let span_text = file.substring(i, i+max_match_size)
			spans.push(new Span(file_nm, line_no, prev_end, char_no, char_no+max_match_size,
								match_type, span_text))
			prev_end = char_no+max_match_size
			i += max_match_size - 1
			for (let c of span_text) {
				if (c == '\n') {
					++ line_no
					char_no = 0
				}
				else ++ char_no
			}
		}
		return spans
	}
}
class Line
{
	constructor(span) {
		this.span = span
		this.parent = null
		this.children = []
		this.original
	}
	copy() {
		return new Line(undefined)
	}
}
function tree_format_assert(line, condition, err_msg) {
	if (condition) return
	while (line.constructor.name == 'Span')
		line = line.parent
	throw new LexicalError(line.span, err_msg)
}
function report_indentation_error(line) {
	tree_format_assert(line, false, 'Indentation error: '+line.span.get_text(true))
}
class Tree
{
	constructor() {
		this.rules = new Map()
	}
}
class Rule
{
	constructor(action, left, op, right) {
		this.action = action
		this.left = left
		this.op = op
		this.right = right
	}
	key() {
		let t = this.left+' '+this.op
		for (let r of this.right) t += ' '+r
		return t
	}
}
class SyntaxError extends Error {
	constructor(span, err_msg) {
		super(err_msg)
		this.span = span
	}
}
__repeat_marks = new Set(['+', '+,', '+.'])
class LineParser
{
	constructor() {
		this.rules = new Map()
		this.rule_end_at = new Map()
		this._reset()
		this._inited = false
	}
	add_rule(rule) {
		this.rules.set(rule.key(), rule)
	}
	_init() {
		if (this._inited) return
		this._inited = true
		for (let [key, rule] of this.rules) {
			if (rule.op != '<-') continue
			let type = rule.right[rule.right.length - 1]
			if (! this.rule_end_at.has(type))
				this.rule_end_at.set(type, [])
			this.rule_end_at.get(type).push(rule)
		}
	}
	_reset() {
		this.spans = new Map()
		this.spans_end_at = new Map()
		this.to_reduce = []
	}
	_try_add_repeats(type, prev_order, repeat_mark) {
		let span_end_at = this.spans_end_at.get(prev_order)
		let prev_done = []
		for (let prev_span of span_end_at)
			if (prev_span.type == type+repeat_mark)
				prev_done.push(prev_span)
		let list = []
		let mark = repeat_mark.substring(1)
		while (prev_order >= 0) {
			span_end_at = this.spans_end_at.get(prev_order)
			let prev_prev_order = prev_order
			let best_prev_span = null
			for (let prev_span of span_end_at) {
				if (prev_span.type != type) continue
				if (prev_span.prev_order < prev_prev_order) {
					prev_prev_order = prev_span.prev_order
					best_prev_span = prev_span
				}
			}
			if (best_prev_span == null) break
			list.unshift(best_prev_span)
			prev_order = prev_prev_order
			if (mark != '') {
				best_prev_span = null
				if (! this.spans_end_at.has(prev_order)) break
				span_end_at = this.spans_end_at.get(prev_order)
				for (let prev_span of span_end_at) {
					if (prev_span.text == mark) { // change from 'type' to 'text'
						prev_prev_order = prev_span.prev_order
						best_prev_span = prev_span
						break
					}
				}
				if (best_prev_span == null) break
				prev_order = prev_prev_order
			}
		}
		if (list.length == 0) return null
		let rule_key = type+repeat_mark+' <-'
		for (let i=0; i<list.length; ++i)
			rule_key+=' '+type
		for (let p of prev_done)
			if (p.prev_order <= list[0].prev_order)
				return null
		return this._add_new_span(type+repeat_mark, rule_key, list)
	}
	_add_new_span(left, rule_key, matched_list) {
		let first = matched_list[0]
		let end = matched_list[matched_list.length - 1]
		let matched = new Span(first.file_nm,first.line_no,
			first.prev_end,first.char_start,end.char_end,left,null)
		matched.rule_key = rule_key
		matched.order = end.order
		matched.prev_order = first.prev_order
		matched.children = matched_list
		if (this.spans.has(matched.key()))
			this._report_ambiguity_error(matched, this.spans.get(matched.key()))
		this.spans.set(matched.key(), matched)
		this.spans_end_at.get(matched.order).push(matched)
		return matched
	}
	_try_match_rule(rule, span, matched_list) {
		matched_list = matched_list.slice(0) 
		matched_list.unshift(span)
		if (matched_list.length == rule.right.length) {
			let matched = this._add_new_span(rule.left, rule.key(), matched_list)
			this.to_reduce.push(matched)
		}
		else {
			let prev_type = rule.right[rule.right.length-1-matched_list.length]
			if (this.spans_end_at.has(span.prev_order)) {
				let rindex = prev_type.lastIndexOf('+')
				if (prev_type[0]!="'" && rindex!=-1) {
					let repeat_mark = prev_type.substring(rindex)
					this._try_add_repeats(prev_type.slice(0, -repeat_mark.length), span.prev_order, repeat_mark)
				}
				let span_end_at = this.spans_end_at.get(span.prev_order)
				for (let prev_span of span_end_at) {
					if (prev_span.type == prev_type)
						this._try_match_rule(rule, prev_span, matched_list)
				}
			}
		}
	}
	_add_span(span) {
		this.to_reduce.push(span)
		while (this.to_reduce.length > 0) {
			let to_reduce1 = this.to_reduce.shift()
			if (this.rule_end_at.has(to_reduce1.type)) {
				let rules = this.rule_end_at.get(to_reduce1.type)
				for (let rule of rules)
					this._try_match_rule(rule, to_reduce1, [])
			}
			for (let repeat_mark of __repeat_marks) {
				if (this.rule_end_at.has(to_reduce1.type+repeat_mark)) {
					let repeat = this._try_add_repeats(to_reduce1.type, to_reduce1.order, repeat_mark)
					if (repeat != null)
						this._add_span(repeat)
				}
			}
		}
	}
	_reduce(spans) {
		this._init()
		this._reset()
		let i = 0
		for (let span of spans) {
			span.prev_order = i-1
			span.order = i
			i += 1
			this.spans_end_at.set(span.order, [span])
			this._add_span(span)
		}
	}
	_get_result(spans, test) {
		let end = spans[spans.length-1].order
		let span_end_at = this.spans_end_at.get(end)
		let res = null
		for (let span of span_end_at) {
			if (span.prev_order == -1 && test(span.type))
				if (res == null) res = span
				else this._report_ambiguity_error(res, span)
		}
		if (res == null)
			this._report_syntax_error(spans)
		return res
	}
	reduce(spans, test) {
		if (test==null) test=(t=>t[0]=='#')
		this._reduce(spans)
		let span = this._get_result(spans,test)
		function fix_parent(s) {
			for (let c of s.children) {
				c.parent = s
				fix_parent(c)
			}
		}
		fix_parent(span)
		return span
	}
	_report_ambiguity_error(span1, span2) {
		function span_repr(span, indent) {
			let text = ''
			for (let i = 0; i < indent; ++ i) text += ' '
			text += span.type+' ->'
			if (span.children.length == 0)
				text += ' '+span.text
			else
				for (let c of span.children)
					text += ' '+c.type
			return text+'\n'
		}
		function dfs_repr(span1, span2, indent) {
			let repr1 = span_repr(span1, indent)
			let repr2 = span_repr(span2, indent)
			for (let i = 0; i < span1.children.length && i < span2.children.length; ++ i) {
				let c_repr = dfs_repr(span1.children[i], span2.children[i], indent+2)
				if (c_repr[0] != c_repr[1]) return [repr1+c_repr[0], repr2+c_repr[1]]
				repr1 += c_repr[0]
				repr2 += c_repr[1]
			}
			return [repr1, repr2]
		}
		let repr = dfs_repr(span1, span2, 0)
		let err_msg = 'Ambiguous spans: '+span1.get_text(true)+'\n1:\n'+repr[0]+'\n2:\n'+repr[1]
		throw new Error(err_msg)
	}
	_report_syntax_error(spans) {
		let this_ = this
		let prefix_map = new Map()
		let postfix_of_prefix_set = new Set()
		let repeats_set = new Map()
		for (let repeat_mark of __repeat_marks)
			repeats_set.set(repeat_mark, new Set())
		for (let rule of this.rules.values()) {
			if (rule.op != '<-') continue
			for (let i = 0; i < rule.right.length; ++ i) {
				let prefix_slice = rule.right.slice(0, i+1)
				let prefix_repr = prefix_slice.join(' ')
				if (! prefix_map.has(prefix_repr))
					prefix_map.set(prefix_repr, new Set())
				prefix_map.get(prefix_repr).add(rule.left)
				for (let j = 1; j < prefix_slice.length; ++ j) {
					let postfix_of_prefix = prefix_slice.slice(j).join(' ')
					postfix_of_prefix_set.add(postfix_of_prefix)
					let pre_span = prefix_slice[j-1]
					for (let repeat_mark of __repeat_marks)
						if (pre_span.endsWith(repeat_mark))
							repeats_set.get(repeat_mark).add(pre_span.slice(0,-repeat_mark.length))
				}
			}
		}
		let span_checked = new Set()
		function is_postfix_of_prefix(postfix_of_prefix, spans) {
			let head_span = spans[0]
			let tail_span = spans[spans.length-1]
			for (let repeat_mark of __repeat_marks) {
				if (repeats_set.get(repeat_mark).has(head_span.type)) {
					let postfix_of_prefix2 = head_span.type+repeat_mark+postfix_of_prefix.substring(head_span.type.length)
					if (prefix_map.has(postfix_of_prefix2) || postfix_of_prefix_set.has(postfix_of_prefix2)) {
						this_._try_add_repeats(head_span.type, head_span.order, repeat_mark)
						let span_end_at = this_.spans_end_at.get(head_span.order)
						for (let prev_span of span_end_at)
							if (prev_span.type == head_span.type+repeat_mark)
								if (head_span.prev_order <= prev_span.prev_order)
									if (is_postfix_of_prefix(postfix_of_prefix2, [prev_span,tail_span]))
										return true
					}
				}
			}
			if (prefix_map.has(postfix_of_prefix)) {
				for (let left of prefix_map.get(postfix_of_prefix)) {
					if (left[0]=='#' && head_span.prev_order==-1) return true
					if (left == head_span.type && head_span.order == tail_span.order) continue
					let span = new Span('', 0, 0, 0, 0, left, null)
					span.prev_order = head_span.prev_order
					span.order = tail_span.order
					let span_key = span.type+'@'+(span.prev_order)+'-'+span.order
					if (span_checked.has(span_key)) continue
					span_checked.add(span_key)
					this_.spans_end_at.get(span.order).push(span)
					if (is_postfix_of_prefix(left, [span]))
						return true
				}
			}
			if (postfix_of_prefix_set.has(postfix_of_prefix)) {
				if (this_.spans_end_at.has(head_span.prev_order))
					for (let prev_span of this_.spans_end_at.get(head_span.prev_order)) {
						if (is_postfix_of_prefix(prev_span.type+' '+postfix_of_prefix, [prev_span,tail_span]))
							return true
					}
			}
			return false
		}
		function get_last_valid_span_index() {
			for (let i = spans.length-1; i >= 0; -- i) {
				if (this_.spans_end_at.has(spans[i].order))
					if (is_postfix_of_prefix(spans[i].type, [spans[i]]))
						return i
			}
			return 0
		}
		let err_index = get_last_valid_span_index()+1
		let span = null
		let err_msg = null
		let char_no = null
		if (err_index < spans.length) {
			span = spans[err_index]
			err_msg = span.text
			char_no = span.char_start+1
		}
		else {
			span = spans[spans.length-1]
			err_msg = '\\n or EOF'
			char_no = span.char_end+1
		}
		throw new SyntaxError(span, 'unexpected '+err_msg)
	}
}
let _temp_ids = new Set()
function _get_temp_id() {
	let i = 1
	while (_temp_ids.has('_'+i))
		++ i
	_temp_ids.add('_'+i)
	return '_'+i
}
function _tx_assert(span, con) {
	tree_format_assert(new Line(span), con, 'Tree conversion error')
}
function _tx_assert_prev_sibling(span, prev_span_type) {
	let prev_span = null
	let parent = span.parent.parent
	if (parent != null) {
		let index = parent.children.indexOf(span.parent)
		if (index > 0)
			prev_span = parent.children[index-1].span
	}
	if (prev_span_type.constructor.name != 'Array')
		prev_span_type = [prev_span_type]
	tree_format_assert(span.parent, prev_span!=null&&prev_span_type.indexOf(prev_span.type)!=1, 'Dangling '+span.type)
}
function _tx_assert_having_children(span) {
	let line = span.parent
	tree_format_assert(line, line.children.length>0, 'Expect a child block')
}
function _tx_new_line(new_line) {
	if (new_line instanceof Span) {
		let line = new Line(new_line)
		new_line.parent = line
		new_line = line
	}
	return new_line
}
function _add_line_before(cur_line, new_line) {
	while (cur_line instanceof Span)
		cur_line = cur_line.parent
	new_line = _tx_new_line(new_line)
	let index = cur_line.parent.children.indexOf(cur_line)
	cur_line.parent.children.splice(index, 0, new_line);
	new_line.parent = cur_line.parent
}
function _add_line_after(cur_line, new_line) {
	while (cur_line instanceof Span)
		cur_line = cur_line.parent
	new_line = _tx_new_line(new_line)
	let index = cur_line.parent.children.indexOf(cur_line)
	cur_line.parent.children.splice(index+1, 0, new_line);
	new_line.parent = cur_line.parent
}
function _remove_line(line) {
	while (line instanceof Span)
		line = line.parent
	let index = line.parent.children.indexOf(line)
	line.parent.children.splice(index, 1);
}
function _add_first_child(cur_line, new_line) {
	while (cur_line instanceof Span)
		cur_line = cur_line.parent
	new_line = _tx_new_line(new_line)
	cur_line.children.unshift(new_line)
	new_line.parent = cur_line
}
function _clone_span(span0, type, rule_key, children) {
	span = new Span(span0.file_nm, span0.line_no, span0.prev_end, span0.char_start, span0.char_end, type, span0.text)
	if (children.constructor.name != 'Array')
		children = [children]
	span.children = children
	span.rule_key = rule_key
	for (let c of children)
		c.parent = span
	span.original = span0
	return span
}
function _tx_replace_span(sl,type,from,to) {
	if (sl instanceof Line) 
		_tx_replace_span(sl.span,type,from,to)
	else
		if (sl === from || (sl.type==type && sl.get_text()==from)) {
			if (sl.parent.span == sl)
				sl.parent.span = to
			else {
				let index = sl.parent.children.indexOf(sl)
				sl.parent.children[index] = to
			}
			to.parent = sl.parent
			return
		}
	for (let c of sl.children)
		_tx_replace_span(c,type,from,to)
}
function _add_assign_before(cur_span, name, span) {
	let assign = parse_exp(name+'=e', '#assign', span)
	assign.children[2].children[0] = span
	span.parent = assign.children[2]
	_add_line_before(cur_span, assign)
	convert(assign)
}
function _convert_factor_and_add_assign_before(factor_span) {
	let span = _clone_span(factor_span, factor_span.type, factor_span.rule_key, factor_span.children)
	factor_span.rule_key = 'factor <- $id'
	let name = _get_temp_id()
	let id_ = _clone_span(factor_span, '$id', null, [])
	id_.text = name
	factor_span.children = [ id_ ]
	id_.parent = factor_span
	let exp = _clone_span(span, 'exp', 'exp <- factor', span)
	_add_assign_before(factor_span, name, exp)
	return name
}
function _convert_exp_and_add_assign_before(exp_span) {
	let span = _clone_span(exp_span, exp_span.type, exp_span.rule_key, exp_span.children)
	exp_span.rule_key = 'exp <- factor'
	let factor_span = _clone_span(exp_span, 'factor', 'factor <- $id', [])
	exp_span.children = [factor_span]
	factor_span.parent = exp_span
	let name = _get_temp_id()
	let id_ = _clone_span(exp_span, '$id', null, [])
	id_.text = name
	factor_span.children = [ id_ ]
	id_.parent = factor_span
	_add_assign_before(exp_span, name, span)
}
function _factor_need_expand(span) {
	if (span.children.length > 1) return true
	let c_types = ['$text', '$multitext', "'None'", "'True'", "'False'", '$int', '$float', '$id', 'tuple', 'list', 'dict', 'set']
	return c_types.indexOf(span.children[0].type) == -1
}
function _tx_simplify_factor(span) {
	_tx_assert(span, span.type=='factor')
	if (_factor_need_expand(span))
		_convert_factor_and_add_assign_before(span)
	else
		convert(span)
}
function _tx_simplify_factors(span1, span2) {
	_tx_simplify_factor(span1)
	_tx_simplify_factor(span2)
}
function _exp_need_expand(span) {
	if (span.children.length > 1) return true
	span = span.children[0]
	_tx_assert(span, span.type=='factor')
	return _factor_need_expand(span)
}
function _tx_simplify_exp(span) {
	_tx_assert(span, span.type=='exp')
	if (_exp_need_expand(span))
		_convert_exp_and_add_assign_before(span)
	else
		convert(span)
}
function _tx_simplify_exps(spans) {
	for (let s of spans)
		_tx_simplify_exp(s)
}
function _add_assign_after(lexp, name, span) {
	let assign = parse_exp('e='+name, '#assign', span)
	assign.children[0].children[0] = span
	span.parent = assign.children[0]
	_add_line_after(lexp, assign)
	convert(assign)
}
function _convert_lexp_and_add_assign_after(lexp) {
	let span = _clone_span(lexp, lexp.type, lexp.rule_key, lexp.children.slice(0))
	lexp.rule_key = 'lexp <- $id'
	let name = _get_temp_id()
	let id_ = _clone_span(lexp, '$id', null, [])
	id_.text = name
	lexp.children = [id_]
	id_.parent=lexp
	_add_assign_after(lexp, name, span)
}
function _tx_simplify_lexp(span) {
	_tx_assert(span, span.type=='lexp')
	if (span.children[0].type!='$id')
		_convert_lexp_and_add_assign_after(span)
}
function _tx_simplify_lexps(spans) {
	for (let s of spans)
		_tx_simplify_lexp(s)
}
function _tx_class_id_exp(span) {
	_tx_simplify_exps(span.children[3].children)
}
function _tx_def_id_param(span) {
	let params = span.children[3].children
	let exps = []
	for (let p of params)
		if (p.children.length == 3)
			if (_exp_need_expand(p.children[2]))
				exps.push(p.children[2])
	_tx_simplify_exps(exps)
}
function _tx_def_id_param_comma(span) {
	_tx_def_id_param(span)
}
function _tx_def_id_param_id(span) {
	_tx_def_id_param(span)
}
function _tx_def_id_param_id_comma(span) {
	_tx_def_id_param(span)
}
function _tx_if_exp(span) {
	_tx_simplify_exp(span.children[1])
}
function _tx_elif_exp(span) {
	_tx_assert_prev_sibling(span, ['if','elif'])
	let new_else = parse_lines('else:',span)[0]
	_add_line_before(span, new_else)
	let outer_line = span.parent.parent
	let s = outer_line.children.indexOf(span.parent)
	let e = s+1
	while (e<outer_line.children.length && outer_line.children[e].span.type=='#elif')
		e+=1
	if (e<outer_line.children.length && outer_line.children[e].span.type=='#else')
		e+=1
	let new_if = outer_line.children.splice(s,e-s)
	for (let i = new_if.length-1; i >=0; -- i)
		_add_first_child(new_else, new_if[i])
	let if_span = parse_exp('if True:', '#if', span)
	if_span.children[0].children[1] = new_if[0].span.children[1]
	new_if[0].span.children[1].parent = if_span.children[0]
	new_if[0].span = if_span
	if_span.parent = new_if[0]
	convert(new_else)
}
function _tx_else(span) {
	_tx_assert_prev_sibling(span, ['if','elif','for','while','except'])
}
function _tx_for_id_in_exp(span) {
	_tx_assert_having_children(span)
	_tx_simplify_exp(span.children[3])
	let lexp_ = span.children[1]
	let exp = span.children[3]
	let x = []
	for (let c of lexp_.children) x.push(c.get_text())
	let it = _get_temp_id()
	let code1 = it+'=iter('+exp.get_text()+')'
	let line1 = parse_lines(code1,exp)[0]
	let code2 = x.join(',')+'=next('+it+')'
	let line2 = parse_lines(code2,exp)[0]
	_add_first_child(span,line2)
	let span2 = parse_exp('while True:','#while',span.parent)
	span.parent.type = span2.type
	span.parent.rule_key = span2.rule_key
	span.parent.text = span2.text
	span.parent.children = span2.children
	for (let c of span.parent.children)
		c.parent = span.parent
	_add_line_before(span, line1)
}
function _tx_while_exp(span) {
	_tx_assert_having_children(span)
	let exp = span.children[1]
	if (exp.get_text() != 'True') {
		span.children[1] = parse_exp('True','exp',exp)
		span.children[1].parent = span
		let if_line = parse_exp('if not(__e__):', '#if', exp)
		_tx_replace_span(if_line,'exp','__e__',exp)
		_add_first_child(span, if_line)
		let _stop = parse_exp('raise StopIteration()', '#exit', exp)
		_add_first_child(if_line,_stop)
		convert(if_line)
	}
}
function _tx_assign_lexp_exp(span) {
	if (span.children[2].children.length == 1 && span.children[0].children.length == 1) {
		if (_exp_need_expand(span.children[2].children[0]) && span.children[0].children[0].children[0].type!='$id')
			_tx_simplify_exp(span.children[2].children[0])
		else
			convert(span.children[2].children[0])
		convert(span.children[0].children[0])
		return
	}
	if (span.children[2].children.length > 1 && span.children[0].children.length > 1) {
		let name = _get_temp_id()
		let assign1 = parse_exp(name+'=1','#assign',span)
		let assign2 = parse_exp('x='+name,'#assign',span)
		_add_line_before(span,assign1)
		assign1.children[2] = span.children[2]
		span.children[2].parent = assign1
		span.children[2] = assign2.children[2]
		assign2.children[2].parent = span
		convert(assign1)
	}
	if (span.children[2].children.length == 1) {
		convert(span.children[2].children[0])
		_tx_simplify_lexps(span.children[0].children)
	}
	else {
		_tx_simplify_exps(span.children[2].children)
		convert(span.children[0].children[0])
	}
}
function _tx_assert_assert_exp(span) {
	_tx_simplify_exp(span.children[1])
}
function _tx_assert_assert_exp_exp(span) {
	_tx_simplify_exp(span.children[1])
	_tx_simplify_exp(span.children[3])
}
function _tx_exit_return(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_exit_yield(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_exit_raise(span) {
	_tx_simplify_exp(span.children[1])
}
function _tx_except(span) {
	_tx_assert_prev_sibling(span, ['try','except'])
}
function _tx_except_id(span) {
	_tx_assert_prev_sibling(span, ['try','except'])
}
function _tx_except_id_as_id(span) {
	_tx_assert_prev_sibling(span, ['try','except'])
}
function _tx_finally(span) {
	_tx_assert_prev_sibling(span, ['try','except','else'])
}
function _tx_fun_call_factor(span) {
	_tx_simplify_factor(span.children[0])
}
function _tx_fun_call_factor_arg_(span) {
	_tx_simplify_factor(span.children[0])
	let args = span.children[2].children
	for (let arg of args) {
		_tx_simplify_exp(arg.children[arg.children.length-1])
	}
}
function _tx_fun_call_factor_arg_2(span) {
	_tx_fun_call_factor_arg_(span)
}
function _tx_exp_lambda(span) {
	let param_ = span.children[1]
	let exp_ = span.children[3]
	let func_name = _get_temp_id()
	let func_line = parse_lines('def '+func_name+'(x):\n\treturn y',span)[0]
	_add_line_before(span, func_line)
	func_line.span.children[3] = param_
	param_.parent = func_line.span
	func_line.children[0].span.children[1] = exp_
	exp_.parent = func_line.children[0].span
	convert(func_line)
	let span2 = parse_exp(func_name, 'exp', span)
	span.rule_key = span2.rule_key
	span.children = span2.children
	span.children[0].parent = span
}
function _tx_exp_if_exp_else_exp(span) {
	let exp1 = span.children[0]
	let exp2 = span.children[2]
	let exp3 = span.children[4]
	let tmp_id = _get_temp_id()
	let lines = parse_lines('if True:\n\t'+tmp_id+'=1\nelse:\n\t'+tmp_id+'=1',span)
	let if_line = lines[0]
	let else_line = lines[1]
	_add_line_before(span, if_line)
	_add_line_before(span, else_line)
	if_line.span.children[0].children[1] = exp2
	exp2.parent = if_line.span.children[0]
	if_line.children[0].span.children[2].children[0] = exp1
	exp1.parent = if_line.children[0].span.children[2]
	else_line.children[0].span.children[2].children[0] = exp3
	exp3.parent = else_line.children[0].span.children[2]
	convert(if_line)
	convert(else_line)
	let span2 = parse_exp(tmp_id, 'exp', span)
	span.rule_key = span2.rule_key
	span.children = span2.children
	span.children[0].parent = span
}
function _tx_exp_factor_op_factor(span) {
	let op = span.children[1].get_text()
	if (op == 'and' || op == 'or') {
		let left = span.children[0]
		let right = span.children[2]
		let left_id = null
		if (_factor_need_expand(left))
			left_id = _convert_factor_and_add_assign_before(left)
		else {
			let left_type = span.children[0].children[0].type
			left_id = _convert_factor_and_add_assign_before(left)
		}
		let line = parse_lines('if '+(op=='or'?'not ':'')+left_id+':\n\t'+left_id+'=e',span)[0]
		_add_line_before(span, line)
		let exp_span = line.children[0].span.children[2].children[0]
		exp_span.children[0]=right
		right.parent = exp_span
		convert(line)
		left_id = parse_exp(left_id,'factor',span)
		span.rule_key = "exp <- factor"
		span.children = [left_id]
		left_id.parent = span
	}
	else
		_tx_simplify_factors(span.children[0], span.children[2])
}
function _tx_exp_factor_in_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[2])
}
function _tx_exp_factor_not_in_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[3])
}
function _tx_exp_factor_is_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[2])
}
function _tx_exp_factor_is_not_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[3])
}
function _tx_exp_factor_mul_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[2])
}
function _tx_exp_factor_pow_factor(span) {
	_tx_simplify_factors(span.children[0], span.children[2])
}
function _tx_exp_op_factor(span) {
	_tx_simplify_factor(span.children[1])
}
function _tx_exp_not_factor(span) {
	_tx_simplify_factor(span.children[1])
}
function _tx_factor_formattext(span) {
	let fun_call_span = format_text_to_call(span.children[0])
	span.rule_key = 'factor <- fun_call'
	span.children = [fun_call_span]
	fun_call_span.parent = span
	convert(fun_call_span)
}
function _tx_list_exp_plus(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_list_exp_plus_(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_list_exp_generator(span) {
	let name = _tx_new_generator(span, span.children[2], [span.children[1]])
	let i = _get_temp_id()
	let set_name = _get_temp_id()
	let line1 = parse_lines(set_name+'=[]', span)[0]
	_add_line_before(span, line1)
	let line2 = parse_lines('for '+i+' in '+name+'():\n\t'+set_name+'.append('+i+')', span)[0]
	_add_line_before(span, line2)
	convert(line2)
	let p = span.parent
	p.rule_key = 'factor <- $id'
	let id_ = _clone_span(span, '$id', null, [])
	id_.text = set_name
	p.children[0] = id_
	id_.parent = p
}
function _tx_tuple_exp_plus_exp(span) {
	_tx_simplify_exps(span.children[1].children.concat([span.children[3]]))
}
function _tx_tuple_exp_plus_exp_(span) {
	_tx_simplify_exps(span.children[1].children.concat([span.children[3]]))
}
function _tx_tuple_exp(span) {
	_tx_simplify_exp(span.children[1])
}
function _tx_tuple_exp_generator(span) {
	let gen_name = _tx_new_generator(span, span.children[2], [span.children[1]])
	let tuple_name = _get_temp_id()
	let line = parse_lines(tuple_name+'='+gen_name+'()', span)[0]
	_add_line_before(span, line)
	let p = span.parent
	p.rule_key = 'factor <- $id'
	let id_ = _clone_span(span, '$id', null, [])
	id_.text = tuple_name
	p.children[0] = id_
	id_.parent = p
}
function _tx_new_generator(span, gen0, exps0) {
	function to_statement(gen_, exps) {
		x = ''
		for (let i = 0; i < exps.length; ++i)
			x+=(i==0?'':',')+'x'
		let prev_line = parse_lines('yield '+x, span)[0]
		prev_line.span.children[1].children = exps
		for (let e of exps)
			e.parent = prev_line.span.children[1]
		let line = null
		while (gen_ != null) {
			let for_ = gen_.children[gen_.children.length-1]
			gen_ = gen_.children.length > 1 ? gen_.children[0] : null
			let key = for_.children[0].text
			if (key=='for')
				line = parse_lines('for x in y:', span)[0]
			else
				line = parse_lines('if e:', span)[0]
			line.span.children[0] = for_
			for_.parent = line.span
			if (prev_line != null)
				_add_first_child(line, prev_line)
			prev_line = line
		}
		return prev_line
	}
	let gen_ = to_statement(gen0, exps0)
	let name = _get_temp_id()
	let gen = parse_lines('def f():\n\tpass', span)[0]
	gen.span.children[1].text = name
	gen.children[0] = gen_
	gen_.parent = gen
	_add_line_before(span, gen)
	convert(gen)
	return name
}
function _tx_set_exp_plus(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_set_exp_generator(span) {
	let name = _tx_new_generator(span, span.children[2], [span.children[1]])
	let i = _get_temp_id()
	let set_name = _get_temp_id()
	let line1 = parse_lines(set_name+'=set()', span)[0]
	_add_line_before(span, line1)
	let line2 = parse_lines('for '+i+' in '+name+'():\n\t'+set_name+'.add('+i+')', span)[0]
	_add_line_before(span, line2)
	convert(line2)
	let p = span.parent
	p.rule_key = 'factor <- $id'
	let id_ = _clone_span(span, '$id', null, [])
	id_.text = set_name
	p.children[0] = id_
	id_.parent = p
}
function _tx_set_exp_plus_(span) {
	_tx_simplify_exps(span.children[1].children)
}
function _tx_dict_dict_item_plus(span) {
	_tx_dict_dict_item_plus_(span)
}
function _tx_dict_dict_item_plus_(span) {
	let dict_items = span.children[1].children
	let exps = []
	for (let dict_item of dict_items) {
		exps.push(dict_item.children[0])
		exps.push(dict_item.children[2])
	}
	_tx_simplify_exps(exps)
}
function _tx_dict_exp_exp_generator(span) {
	let name = _tx_new_generator(span, span.children[4], [span.children[1],span.children[3]])
	let set_name = _get_temp_id()
	let line1 = parse_lines(set_name+'={}', span)[0]
	_add_line_before(span, line1)
	let k = _get_temp_id()
	let v = _get_temp_id()
	let line2 = parse_lines('for '+k+','+v+' in '+name+'():\n\t'+set_name+'['+k+']='+v, span)[0]
	_add_line_before(span, line2)
	convert(line2)
	let p = span.parent
	p.rule_key = 'factor <- $id'
	let id_ = _clone_span(span, '$id', null, [])
	id_.text = set_name
	p.children[0] = id_
	id_.parent = p
}
function _tx_lexp_1(span) {
	_tx_replace_span(span, null, span, span.children[1])
	_tx_simplify_lexps(span.children[1].children)
}
function _tx_lexp_2(span) {
	_tx_replace_span(span, null, span, span.children[1])
	_tx_simplify_lexps(span.children[1].children)
}
function _tx_lexp_3(span) {
	_tx_replace_span(span, null, span, span.children[1])
	_tx_simplify_lexps(span.children[1].children)
}
function _tx_lexp_4(span) {
	_tx_replace_span(span, null, span, span.children[1])
	_tx_simplify_lexps(span.children[1].children)
}
function _tx_item_exp_factor_slice_0(span) {
	_tx_item_exp_factor_slice_10(span, null, null, null)
}
function _tx_item_exp_factor_slice_1(span) {
	_tx_item_exp_factor_slice_10(span, span.children[2], null, null)
}
function _tx_item_exp_factor_slice_2(span) {
	_tx_item_exp_factor_slice_10(span, null, span.children[3], null)
}
function _tx_item_exp_factor_slice_3(span) {
	_tx_item_exp_factor_slice_10(span, span.children[2], span.children[4], null)
}
function _tx_item_exp_factor_slice_4(span) {
	_tx_item_exp_factor_slice_10(span, span.children[2],null,span.children[5])
}
function _tx_item_exp_factor_slice_5(span) {
	_tx_item_exp_factor_slice_10(span, null,span.children[3],span.children[5])
}
function _tx_item_exp_factor_slice_6(span) {
	_tx_item_exp_factor_slice_10(span, null,null,span.children[4])
}
function _tx_item_exp_factor_slice_7(span) {
	_tx_item_exp_factor_slice_10(span, span.children[2],span.children[4],span.children[6])
}
function _tx_item_exp_factor_slice_10(span,start,stop,step) {
	let exp = parse_exp('slice(None,None,None)', 'exp', span)
	let arg_ = exp.children[0].children[0].children[2].children
	let exp_ = [start,stop,step]
	for (let i in arg_)
		if (exp_[i] != null) {
			arg_[i].children[0] = exp_[i]
			exp_[i].parent = arg_[i]
		}
	span.rule_key = "item_exp <- factor '[' exp ']'"
	span.children.splice(2,span.children.length-4)
	span.children[2] = exp
	exp.parent = span
	convert(span)
}
function _tx_item_exp_factor_exp(span) {
	_tx_simplify_factor(span.children[0])
	_tx_simplify_exp(span.children[2])
}
function _tx_attribute_factor_id(span) {
	_tx_simplify_factor(span.children[0])
}
function _tx_with_exp(span) {
	return _tx_with_1(span)
}
function _tx_with_exp_as_id(span) {
	return _tx_with_1(span)
}
function _tx_with_1(span) {
	let r = _get_temp_id()
	let id_ = _get_temp_id()
	if (span.children.length==5)
		id_ = span.children[3].get_text()
	_add_assign_before(span, r, span.children[1])
	let enter = parse_lines(id_+'='+r+'.__enter__()', span)[0]
	_add_line_before(span, enter)
	let except_ = parse_lines('except:', span)[0]
	_add_line_after(span, except_)
	let exit_1 = parse_lines('if '+r+'.__exit__(*__rt_exc_info()) is not True:', span)[0]
	_add_first_child(except_, exit_1)
	let exit_raise = parse_lines('raise', span)[0]
	_add_first_child(exit_1, exit_raise)
	convert(exit_1)
	let else_ = parse_lines('else:', span)[0]
	_add_line_after(except_, else_)
	let exit_2 = parse_lines(r+'.__exit__(None, None, None)', span)[0]
	_add_first_child(else_, exit_2)
	convert(exit_2)
	let try_ = parse_lines('try:', span)[0]
	_tx_replace_span(span,'#with',span,try_.span)
}
class _Scope
{
	constructor(module_scope, outer_scope) {
		this.module_scope = module_scope
		this.outer_scope = outer_scope
		this.vars = new Map()
		this.globals = new Set()
		this.nonlocals = new Set()
		this.implicit_globals = new Set()
		this.implicit_nonlocals = new Set()
		this.block_level = 0
		this.block_info = []
	}
	__get_nonlocal(name) {
		if (this.outer_scope == null) return null
		if (this.outer_scope.vars.has(name))
			return this.outer_scope.vars.get(name)
		return this.outer_scope.__get_nonlocal(name)
	}
	__get_local(name) {
		if (this.vars.has(name))
			return this.vars.get(name)
		let nl = this.__get_nonlocal(name)
		if (nl != null) {
			if (! this.nonlocals.has(name)) {
				this.implicit_nonlocals.add(name)
			}
			return nl
		}
		if (this.module_scope!==this) {
			let g = this.module_scope.__get_local(name)
			if (g != null) {
				if (! this.globals.has(name)) {
					this.implicit_globals.add(name)
				}
				return g
			}
		}
		return null
	}
	get(name) {
		let v = this.__get_local(name)
		if (v != null) return v
		if (__builtins.has(name))
			return __builtins.get(name)
		return null;
	}
	__del_nonlocal(name) {
		if (this.outer_scope == null) return false
		if (this.outer_scope.vars.has(name)) {
			this.outer_scope.vars.delete(name)
			return true
		}
		return this.outer_scope.__del_nonlocal(name)
	}
	del(span, name) {
		if (name===undefined) throw new Error()
		if (this.vars.has(name)) {
			this.vars.delete(name)
			return true
		}
		if (this.outer_scope!=null && this.nonlocals.has(name)) {
			if (this.__del_nonlocal(name))
				return true
		}
		if (this.module_scope!==this && this.globals.has(name))
			return this.module_scope.del(span, name)
		if (this.implicit_nonlocals.has(name) || this.implicit_globals.has(name)) {
			__raise_exception(span, __new_obj('UnboundLocalError', "local variable '"+name+"' deleted before assignment"))
			return
		}
		return false
	}
	__not_yet_def(name) {
		if (this.vars.has(name)) return false
		if (this.globals.has(name)) return false
		if (this.nonlocals.has(name)) return false
		return true
	}
	bind_global(name) {
		if (this.__not_yet_def(name)) {
			this.globals.add(name)
			return true
		}
		return false
	}
	bind_nonlocal(name) {
		if (this.__not_yet_def(name) && this.__get_nonlocal(name)!=null) {
			this.nonlocals.add(name)
			return true
		}
		return false
	}
	__set_nonlocal(name, val) {
		if (this.outer_scope == null) return false
		if (this.outer_scope.vars.has(name)) {
			this.outer_scope.vars.set(name, val)
			return true
		}
		return this.outer_scope.__set_nonlocal(name, val)
	}
	set(span, name, val) {
		if (val===undefined) throw new Error()
		if (this.vars.has(name)) {
			this.vars.set(name, val)
			return
		}
		if (this.outer_scope!=null && this.nonlocals.has(name)) {
			this.__set_nonlocal(name, val)
			return
		}
		if (this.module_scope!==this && this.globals.has(name)) {
			this.module_scope.set(span, name, val)
			return
		}
		if (this.implicit_nonlocals.has(name) || this.implicit_globals.has(name)) {
			__raise_exception(span, __new_obj('UnboundLocalError', "local variable '"+name+"' referenced before assignment"))
			return
		}
		this.vars.set(name, val)
	}
	__show_info(msg, sl) {
		msg += ' scope.loc:'+runtime.cur_thread.cur_scope.loc
		if (runtime.cur_thread.exit_val!=null)
			msg+=' '+runtime.cur_thread.exit_val.type
		if (runtime.cur_thread.resume_val!=null)
			msg+=' resume:'+runtime.cur_thread.resume_val.type
		if (sl != null) {
			if (sl.constructor.name == 'Line')
				sl = sl.span
			if (sl!==undefined)
				msg+=' (line '+(sl.line_no+1)+')'
		}
		let repr = this.block_level+' '
		let bi = []
		for (let i of this.block_info) {
			bi.push(i.next_line)
			bi.push(i.else_val)
		}
		repr += '['+bi.join(',')+'] '
		for (let [k,v] of this.vars)
			repr += ' '+k+':'+_type_name(v)+"="+(v==null?'null':__repr(undefined,v).value)
		console.log(msg, repr)
	}
	enter_block(line) {
		++ this.block_level
		if (runtime.cur_thread.resume_val == null)
			this.block_info.push({'next_line':0,'else_val':false,'ex_val':null})
		if (this.block_level>this.block_info.length) {
			__raise_exception(undefined, __new_obj('RuntimeError', 'Wrong block_level('+this.block_level+'>'+this.block_info.length+')'))
		}
	}
	leave_block(line) {
		let exit_type = runtime.cur_thread.exit_val
		if (exit_type != null)
			exit_type = exit_type.type
		-- this.block_level
		if (exit_type!='yield' && exit_type!='interrupt') {
			this.block_info.pop()
		}
	}
	cur_block() {
		return this.block_info[this.block_level-1]
	}
}
let python_op1_function = new Map([
								['~', '__invert__'],
								['not', '__not__'],
								['-', '__neg__'],
								['+', '__pos__'],
								])
let python_op2_function = new Map([
								['+', '__add__'],
								['in', '__contains__'],
								['/', '__truediv__'],
								['//', '__floordiv__'],
								['&', '__and__'],
								['^', '__xor__'],
								['|', '__or__'],
								['**', '__pow__'],
								['is', '__is__'],
								['<<', '__lshift__'],
								['%', '__mod__'],
								['*', '__mul__'],
								['@', '__matmul__'],
								['-', '__sub__'],
								['>>', '__rshift__'],
								['<', '__lt__'],
								['<=', '__le__'],
								['==', '__eq__'],
								['!=', '__ne__'],
								['>=', '__ge__'],
								['>', '__gt__'],
								['[]', '__getitem__'],
								['del[]', '__delitem__'],
								])
let python_op3_function = new Map([
								['[]=', '__setitem__'],
								])
class _Thread
{
	constructor(thread_id) {
		this.thread_id = thread_id
		this.local_stack = []
		this.call_stack = []
		this.stack_size = 0
		this.cur_scope = new _Scope(null, null)
		this.cur_scope.loc = 'thread #'+this.thread_id
		this.cur_scope.module_scope = this.cur_scope
		this.exit_val = null
		this.cur_ex = null
		this.resume_val = null
		this.return_val = null
	}
	__exit_or_interrupt_thread() {
		if (this.exit_val == null) return null
		if (this.exit_val.type=='exception') {
			let ex = this.exit_val.value
			let ex_type = _type_name(ex)
			if (ex_type != 'SystemExit') {
				runtime.__print_stacktrace(ex)
			}
			return null
		}
		if (this.exit_val.type=='interrupt') {
			let interrupt = this.exit_val.value
			this.exit_val = null
			return interrupt
		}
		console.log('Unexpected exit type: '+this.exit_val.type)
	}
	__run_block(parent) {
		function show_info(info, exit_val) {
			let repr = '  '+(parent.span==null?'none':parent.span.type+'@'+parent.span.line_no)+' '
			for (let info1 of info)
				repr += info1.next_line+' '
			return repr + (exit_val==null?'':exit_val.type)
		}
		if (parent.children.length == 0)
			report_indentation_error(parent)
		let line_count = 0
		let prev_line = null;
		for (let cur_line of parent.children) {
			let type = cur_line.span.type.slice(1)
			let prev_type = (prev_line == null ? null : prev_line.span.type.slice(1))
			prev_line = cur_line
			if (line_count < this.cur_scope.cur_block().next_line) {
				line_count += 1
				continue
			}
			if (this.exit_val != null) {
				if (! (type == 'except' || (prev_type == 'except' && type == 'else') || type == 'finally')) break
			}
			this.cur_scope.cur_block().next_line = line_count
			let cur_scope = this.cur_scope
			action(cur_line)
			if (cur_scope !== this.cur_scope) {
				console.log('*** Scope mixed up\n')
			}
			if (this.exit_val != null && this.exit_val.type != 'exception') break
			line_count += 1
		}
	}
	run_block(parent) {
		this.cur_scope.enter_block(parent)
		if (this.exit_val != null)
			return
		this.__run_block(parent)
		this.cur_scope.leave_block(parent)
	}
	_check_func_return(func, args, res) {
		if (func.name == '__init__' || func.name.endsWith('.__init__')) {
			if (res===undefined || res===null || res===__none) {
				if (args===null) {
					args = func.runtime_args
					func.runtime_args = null
				}
				return args[0]
			}
			__raise_exception(span, __new_obj('TypeError', "__init__() should return None, not '"+_type_name(res)+"'"))
			return
		}
		if (this.exit_val != null) {
			if (res!=null && res!==undefined)
				console.error (func.name+' should not return', res)
		}
		else {
			func.runtime_args = null
			if (res==null || res===undefined)
				return __none
			return res
		}
	}
	call(span, func, args) {
		let this_ = this
		let func_type_name = _type_name(func)
		if (func_type_name == 'builtin_function_or_method') {
			let kwargs = args.pop()
			let res = func.func(span, args, kwargs)
			if (this.exit_val!==null) return
			return this._check_func_return(func, args, res)
		}
		else if (func_type_name == 'function') {
			let res = this.__run_function(span, func, args)
			if (this.exit_val!==null) return
			return this._check_func_return(func, null, res)
		}
		else {
			__raise_exception(span, __new_obj('TypeError', "'"+func_type_name+"' object is not callable"))
		}
	}
	__check_stack_size() {
		if (this.stack_size != this.local_stack.length)
			throw new Error('* Internal error: incorrect stack size :'+this.stack_size+' ('+this.local_stack.length+')')
	}
	__enter_function(span, func, args) {
		let cur_scope = null
		if (! ('param_info' in func)) {	
			cur_scope = func.module_scope
			func.exit_value_type = null
		}
		else {							
			cur_scope = new _Scope(func.module_scope, func.outer_scope)
			cur_scope.loc = 'function '+func.name
			let params = func.param_info.names
			for (let i = 0; i < params.length; ++ i)
				cur_scope.vars.set(params[i], args[i])
			func.exit_value_type = 'return'
			func.runtime_args = args
		}
		this.__check_stack_size()
		if (span===undefined)
			throw new Error('span is undefined')
		this.call_stack.push(span)
		this.local_stack.push(cur_scope)
		this.return_val = null
	}
	__run_function(span, func, args) {
		if (__timeout(span, 0)) return
		if (this.resume_val == null) {
			this.__enter_function(span, func, args)
		}
		this.cur_scope = this.local_stack[this.stack_size]
		++ this.stack_size
		this.cur_scope.block_level = 0
		this.run_block(func.line)
		if (this.exit_val != null && this.exit_val.type=='yield') {
			let gen = __new_obj('generator', null)
			gen.name = func.name+'.generator'
			gen.cur_scope = this.cur_scope
			gen.span = func.span
			gen.line = func.line
			gen.yield_value = this.exit_val.value
			this.exit_val.type = 'return'
			this.exit_val.value = gen
		}
		return this.__leave_function(func.exit_value_type)
	}
	__leave_function(exit_value_type) {
		-- this.stack_size
		if (this.stack_size>0)
			this.cur_scope = this.local_stack[this.stack_size-1]
		else {
			this.cur_scope = new _Scope(null,null)
			this.cur_scope.module_scope = this.cur_scope
		}
		let exit_type = (this.exit_val==null ? null : this.exit_val.type)
		if (exit_type=='break' || exit_type=='continue') {
			__raise_exception(this.exit_val.span, __new_obj('SyntaxError', "'"+exit_type+"' not properly in loop"))
		}
		if (exit_type != 'interrupt') {
			this.call_stack.pop()
			this.local_stack.pop()
		}
		if (exit_type==exit_value_type || (exit_value_type=='return' && exit_type==null)) {
			this.return_val = (this.exit_val == null ? __none : this.exit_val.value)
			this.exit_val = null
			return this.return_val
		}
		else if (exit_type!=null && exit_type!='exception' && exit_type!='interrupt')
			__raise_exception(this.exit_val.span, __new_obj('SyntaxError', "Unexpected '"+exit_type+"'"))
		return null
	}
	run_op(span, op, objs) {
		let method = null
		if (objs.length == 1) {
			if (python_op1_function.has(op))
				method = python_op1_function.get(op)
		}
		else if (objs.length == 2) {
			if (python_op2_function.has(op))
				method = python_op2_function.get(op)
		}
		if (objs.length == 3) {
			if (python_op3_function.has(op))
				method = python_op3_function.get(op)
		}
		if (method == null) {
			__raise_exception(span, __new_obj('SyntaxError', 'operator '+op+' is not allowed'))
			return null
		}
		else {
			return this.run_method(span, _type(objs[0]), method, objs)
		}
	}
	run_method(span, type, method_name, objs) {
		if (type.constructor.name == 'String')
			type = this.__get_class(span, type)
		let obj = objs[0]
		let m = this.__getattr_1(span, obj, type, method_name)
		if (m===null) {
			__raise_exception(span, __new_obj('AttributeError', "'"+type.attr.get('__name__').value+"' object has no attribute '"+method_name+"'"))
			return null
		}
		else {
			let ret_val = this.__run_method_1(span, type, method_name, m.method, objs)
			if (this.exit_val===null) {
				if (ret_val===null || ret_val===undefined)
					console.error('Method '+type.attr.get('__name__').value+'.'+method_name+' does not return a Python object.')
			}
			else if (ret_val!==null && ret_val!==undefined) {
				console.error('Method '+type.attr.get('__name__').value+'.'+method_name+' raises an exception and returns at the same time')
			}
			return ret_val
		}
	}
	__run_method_1(span, type, method_name, method, objs) {
		let type_name = _type_name(method)
		if (type_name!='function' && type_name!='builtin_function_or_method') {
			__raise_exception(span, __new_obj('AttributeError', "method '"+_type_name(type)+'.'+method_name+"' has an unknown type '"+type_name+"'"))
			return null
		}
		let res = this.__run_method_2(span, method, objs)
		if (res!==null) return res
		return null
	}
	__run_method_2(span, method, objs) {
		objs = objs.concat([new Map()]) 
		let type_name = _type_name(method)
		if (type_name == 'builtin_function_or_method') {
			let kwargs = objs.pop()
			return method.func(span, objs, kwargs)
		}
		if (type_name == 'function') {
			objs.push(new Map()) 
			return this.__run_function(span, method, objs)
		}
		return null
	}
	__get_class(span, type) {
		let v = this.cur_scope.get(type)
		if (v != null && _type_name(v) == 'type') return v
		__raise_exception(span, __new_obj('SyntaxError', "Type '" + type + "' is not defined"))
	}
	__get_super_classes(cls) {
		if (cls.__super__ === undefined || cls.__super__.length == 0)
			cls.__super__ = [this.__get_class(undefined, 'object')]
		for (let i = 0; i < cls.__super__.length; ++ i)
			if (cls.__super__[i].constructor.name == 'String')
				cls.__super__[i] = this.__get_class(undefined, cls.__super__[i])
		return cls.__super__
	}
	__issubclass(span, type, type_obj) {
		if (type.id == type_obj.id) return true
		if (type.attr.get('__name__').value == 'object') return false
		let __super__ = this.__get_super_classes(type)
		for (let t of __super__)
			if (this.__issubclass(span, t, type_obj))
				return true
		return false
	}
	__get_class_attr_1(span, type, attr) {
		let cls = type
		if (type.constructor.name == 'String')
			cls = this.__get_class(span, type)
		if (cls.attr.has(attr))
			return cls.attr.get(attr)
		return null
	}
	__get_class_attr(span, obj, type, attr) {
		let cls_attr = this.__get_class_attr_1(span, type, attr)
		if (cls_attr != null) {
			let type_name = _type_name(cls_attr)
			if (! (type_name == 'function' || type_name == 'builtin_function_or_method'))
				return cls_attr
			let m_obj = __new_obj('method', attr)
			m_obj.obj = obj
			m_obj.method = cls_attr
			return m_obj
		}
		if (type.attr.get('__name__').value == 'object') return null
		let __super__ = this.__get_super_classes(type)
		for (let t of __super__) {
			let m = this.__getattr_1(span, obj, t, attr)
			if (m != null) return m
		}
		return null
	}
	setattr(span, obj, attr, exp) {
		let m = this.__get_class_attr_1(span, _type(obj), '__setattr__')
		if (m != null)
			return this.run_method(span, _type(obj), '__setattr__', [obj, __new_obj('str', attr), exp])
		obj.attr.set(attr, exp)
	}
	__getattr_1(span, obj, type, attr_name) {
		let attr = this.__get_class_attr_1(span, type, attr_name)
		if (attr != null) {
			let type_name = _type_name(attr)
			if (! (type_name == 'function' || type_name == 'builtin_function_or_method'))
				return attr
			let m_obj = __new_obj('method', attr_name)
			m_obj.obj = obj
			m_obj.method = attr
			return m_obj
		}
		let __getattr__ = this.__get_class_attr_1(span, type, '__getattr__')
		if (__getattr__!==null) {
			let attr = this.__run_method_2(span, __getattr__, [obj, __new_obj('str', attr_name)])
			if (this.exit_val===null) {
				if (attr!==undefined && attr!==null)
					return attr
			}
			else
				this.exit_val = null 
		}
		if (type.attr.get('__name__').value == 'object') return null
		let __super__ = this.__get_super_classes(type)
		for (let t of __super__) {
			let m = this.__getattr_1(span, obj, t, attr_name)
			if (m != null) return m
		}
		return null
	}
	__getattr_2(span, obj, attr) {
		if (obj.attr.has(attr)) {
			return obj.attr.get(attr)
		}
		if (attr == '__class__')
			return obj.__class__
		let type = _type(obj)
		if (type.attr.get('__name__').value=='super') {
			type = obj.__super
			obj = obj.__obj
		}
		let res = this.__getattr_1(span, obj, type, attr)
		if (res != null) return res
		return null
	}
	getattr(span, obj, attr) {
		let res = this.__getattr_2(span, obj, attr)
		if (res!==null) return res
		__raise_exception(span, __new_obj('AttributeError', "'"+_type_name(obj)+"' object has no attribute '"+attr+"'"))
	}
	__hasattr_1(span, obj, type, attr_name) {
		let attr = this.__get_class_attr_1(span, type, attr_name)
		if (attr != null)
			return true
		let __getattr__ = this.__get_class_attr_1(span, type, '__getattr__')
		if (__getattr__!==null) {
			let attr = this.__run_method_2(span, __getattr__, [obj, __new_obj('str', attr_name)])
			if (this.exit_val===null) {
				if (attr!==undefined && attr!==null)
					return true
			}
			else
				this.exit_val = null 
		}
		if (type.attr.get('__name__').value == 'object') return null
		let __super__ = this.__get_super_classes(type)
		for (let t of __super__) {
			if (this.__hasattr_1(span, obj, t, attr_name))
				return true
		}
		return false
	}
	hasattr(span, obj, attr) {
		if (obj.attr.has(attr))
			return true
		if (attr == '__class__')
			return true
		let type = _type(obj)
		return this.__hasattr_1(span, obj, _type(obj), attr)
	}
}
function _t() {
	if (runtime.cur_thread.exit_val===null) return
	console.log(runtime.cur_thread.exit_val)
	throw new Error()
}
function __fetch_text(base,path,done,te404,ne200,te,ne) {
	if (runtime.fetch_text_cache.has(base+path)) {
		done(runtime.fetch_text_cache.get(base+path))
		return
	}
	fetch(base+path)
		.then(res => {
			if (res.status != 200) {
				if (res.status == 404) te404(res.statusText)
				else ne200(res.statusText)
				return
			}
			res.text().then(done)
			.catch(error => {console.error(error); te(error)})
		})
		.catch(error => {console.error(error); ne(error)})
}
function __timeout(span, delay_time) {
	if (runtime.cur_thread.exit_val!==null) return false
	if (runtime.timeout<=0) return false
	if (performance.now()-runtime.start_time+delay_time<runtime.timeout*1000) return false
	__raise_exception(span, __new_obj('Timeout', '运行超时 '+runtime.timeout+'秒'))
	return true
}
class Runtime
{
	constructor() {
		this.thread_yield_interval = 100
		this.waited_locks = new Map()
		this.import_base = '/web/py_lib/'
		this.file_base = '/web/'
		this.debug = false
		this._init = null
		this.__stop = true
		this.start_time = 0
		this.timeout = 0
		this.runtime_id = Math.floor(Math.random()*100)*100
		this.fetch_text_cache = new Map()
	}
	_restart(stdin,stdout,stderr,on_started) {
		if (this._init!=null) {
			this._init()
			this._init = null
		}
		_temp_ids.clear()
		this.interrupt_count = 0
		this.stdin = stdin
		this.stdout = stdout
		this.stderr = stderr
		this.threads = []
		this.waiting_threads = new Map()
		this.loaded_modules = new Map()
		this.next_thread_id = 0
		let cur_thread = new _Thread(this.next_thread_id)
		this.cur_thread = cur_thread
		++ this.next_thread_id
		this.__stop = false
		this.start_time = performance.now()
		this.runtime_id += 1
		let this_ = this
		function stdlib_error(err_msg) {
			console.log(err_msg)
			__raise_exception(null, __new_obj('ModuleNotFoundError', err_msg))
			this_._loop()
		}
		function start_main(stdlib) {
			this_.cur_thread = cur_thread
			if (this_.cur_thread.exit_val===null)
				for (let [k,v] of stdlib.module_scope.vars)
					__builtins.set(k,v)
			on_started()
		}
		function start_stdlib(stdlib_source) {
			function final_action(stdlib) { // cannot start a new thread in 'final_action'
				if (stdlib!==null)
					setTimeout(()=>start_main(stdlib), 0)
			}
			this_.__import_module_with_source(null, 'stdlib', stdlib_source, final_action)
		}
		__fetch_text(this.import_base,'_stdlib.py',start_stdlib,stdlib_error,stdlib_error,stdlib_error,stdlib_error)
	}
	__final_action(_done) {
		let succ = true
		if (this.cur_thread!==null && this.cur_thread.exit_val!==null) {
			this.__print_stacktrace(this.cur_thread.exit_val.value)
			succ = false
		}
		if (_done!==undefined && _done!==null)
			_done(succ)
	}
	start(stdin,stdout,stderr,_done) {
		this._restart(stdin,stdout,stderr,()=>this.__final_action(_done))
	}
	_stop() {
		this.__stop = true
		let threads = this.threads.length+this.waiting_threads.size
		if (threads > 0)
			console.error('# of threads alive '+threads+' != 0')
	}
	run(main_source,_done) {
		if (this.__stop===true)
			throw Error('Wrong runtime state')
		let this_ = this
		if (main_source.constructor===String) {
			main_source = [['__main__',main_source]]
		}
		function on_started() {
			let info = main_source.pop(0)
			let action = (main_source.length==0 ? _done : on_started)
			function run_source(name, source) {
				if (this_.cur_thread===null) {
					this_.cur_thread = new _Thread(this_.next_thread_id)
					++ this_.next_thread_id
				}
				else
					delete this_.cur_thread['module_obj'] 
				this_.__import_module_with_source(null, name, source, action)
			}
			if (info[1]!=null)
				run_source(info[0], info[1])
			else
				on_load_module(info[0], source => {
					let name = info[0]
					name = name.split('/')
					name = name[name.length-1].split('.')[0]
					run_source(name, source)
				})
		}
		function on_fetch_error(err_msg) {
			this_.cur_thread.exit_val = __new_obj('ModuleNotFoundError', err_msg)
			if (_done!==undefined && _done!==null)
				_done()
		}
		function on_load_module(module_path,on_module_loaded) {
			this_.load_module('',module_path,on_module_loaded,on_fetch_error,on_fetch_error,on_fetch_error,on_fetch_error)
		}
		on_started()
	}
	stop(main_source,_done) {
		if (this.__stop===true)
			throw Error('Wrong runtime state')
		let this_ = this
		if (main_source!==undefined && main_source!==null) {
			function action() {
				this_.__stop = true
				if (_done!==undefined && _done!==null)
					_done()
			}
			this_.run(main_source, action)
		}
		else {
			if (_done!==undefined && _done!==null)
				_done()
		}
	}
	start_and_run(stdin,stdout,stderr,main_source,_done) {
		let this_ = this
		function _on_started(succ) {
			if (succ)
				this_.run(main_source,_done)
		}
		if (this.__stop)
			this.start(stdin,stdout,stderr,_on_started)
		else
			_on_started(true)
	}
	restart_and_stop(stdin,stdout,stderr,main_source,_done) {
		let this_ = this
		function _on_started(succ) {
			if (succ)
				this_.stop(main_source,_done)
			else
				_done()
		}
		this.start(stdin,stdout,stderr,_on_started)
	}
	__import_module_with_source(span, module_name, source_text, _done) {
		let module_obj = null
		if (this.cur_thread===null)
			throw new Error('cur_thread is null')
		if (! ('module_obj' in this.cur_thread)) {
			module_obj = this.__prepare_module_importer(this.cur_thread, span, module_name)
			module_obj.line = this.__parse_module(module_name, source_text)
			if (this.cur_thread.exit_val != null) {
				let ex = this.cur_thread.exit_val.value
				this.cur_thread.exit_val = null 
				runtime.__print_stacktrace(ex)
				if (_done!==undefined && _done!==null)
					_done(null)
				return
			}
		}
		if (module_obj.line.children.length == 0) {
			if (_done!==undefined && _done!==null)
				_done(module_obj)
		}
		else {
			this.cur_thread.final_action = function(succ) {
				if (_done!==undefined && _done!==null)
					_done(succ ? module_obj : null)
			}
			this.threads.push(this.cur_thread)
			this.cur_thread = null
			this._loop()
		}
	}
	__interrupt(span, before, after, action, timeout) {
		if (this.thread_yield_interval==-1) {
			__raise_exception(span, __new_obj('RuntimeError', 'Interrupt is disabled when calling from javascript.'))
			return
		}
		let thread = this.cur_thread
		let interrupt = {'type':'?', 'action':action, 'timeout':timeout, 'span':span, 'runtime':this}
		if (thread.resume_val == null) {
			if (before != null)
				before(interrupt)
			thread.exit_val = {'type':'interrupt','value':interrupt}
			return null
		}
		else {
			let resume_val = thread.resume_val
			thread.resume_val = null
			if (after != null)
				resume_val = after(resume_val)
			return resume_val
		}
	}
	_interrupt_done(interrupt, res) { 
		if (this!==interrupt.runtime)
			console.log('Interrupt mixed up across different runtimes.')
		interrupt['runtime'] = null
		if ('runtime_id' in interrupt && interrupt.runtime_id!=this.runtime_id) 
			return
		try {
			let thread_id = interrupt.thread_id
			if (this.waiting_threads.has(thread_id)) {
				let thread = this.waiting_threads.get(thread_id)
				this.waiting_threads.delete(thread_id)
				if (res===null) 
					console.error('null interrupt result for thread:', thread)
				thread.resume_val = res
				this.threads.push(thread)
				if (this.cur_thread===null)
					this._loop()
			}
		} catch (ex) {
			console.error(ex)
		}
	}
	_exit_or_hang_thread() {
		let this_ = this
		let thread_id = this.cur_thread.thread_id
		let interrupt = this.cur_thread.__exit_or_interrupt_thread()
		if (interrupt != null) {
			++ this.interrupt_count
			if (interrupt.type=='thread_yield') {
				this.cur_thread.resume_val = interrupt
				this.threads.push(this.cur_thread)
			}
			else {
				this.waiting_threads.set(thread_id, this.cur_thread)
				interrupt.thread_id = thread_id
				interrupt.runtime_id = this.runtime_id
				if ('timeout' in interrupt && interrupt.timeout >= 0) {
					let delay_time = interrupt.timeout*1000
					__timeout(interrupt.span, delay_time)
					if (this.cur_thread.exit_val!==null) {
						this.__print_stacktrace(this.cur_thread.exit_val.value)
					}
					else {
						setTimeout(()=>interrupt.runtime._interrupt_done(interrupt, false), delay_time)
					}
				}
				if ('action' in interrupt && interrupt.action != null) {
					interrupt.action(interrupt) 
				}
			}
		}
		else { 
			if ('final_action' in this.cur_thread) {
				let succ = (this.cur_thread.exit_val===null)
				let final_action = this.cur_thread.final_action
				function final_action_() {
					final_action(succ)
				}
				setTimeout(final_action_, 0)
			}
		}
	}
	_loop() {
		try {
			if (this.__stop) return
			if (this.threads.length>0) {
				this.cur_thread = this.threads.shift()
				this.cur_thread.stack_size = 0
				this.cur_thread.start_time = new Date().getTime()
				this.cur_thread.__run_function(this.cur_thread.span, this.cur_thread.func, this.cur_thread.args)
				__timeout(this.cur_thread.span, 0)
				this._exit_or_hang_thread()
				this.cur_thread = null
				setTimeout(()=>this._loop(), 0)
			}
		} catch (ex) {
			console.error(ex)
		}
	}
	__import_module_interrupt(span, module_name) {
		let this_ = this
		function wait_to_load(loader_thread) {
			function before(interrupt) {
				loader_thread.waiting.push(interrupt)
			}
			this_.__interrupt(span, before, null, null, -1)
		}
		if (this.loaded_modules.has(module_name)) {
			let module_obj = this.loaded_modules.get(module_name)
			let is_exception = this.cur_thread.__issubclass(span, _type(module_obj), this.cur_thread.__get_class(span, 'BaseException'))
			if (is_exception) {
				if (module_obj.span!==undefined && module_obj.span!==null)
					span = module_obj.span
				__raise_exception(span, module_obj)
				return
			}
			let loader_thread = module_obj.__importer
			if (loader_thread == null) { 
				if (this.cur_thread.resume_val == module_obj)
					this.cur_thread.resume_val = null 
				return module_obj
			}
			if (this.cur_thread == loader_thread)
				return loader_thread.module_obj
			else
				wait_to_load(loader_thread)
		}
		else { 
			let loader_thread = new _Thread(this.next_thread_id)
			++ this.next_thread_id
			loader_thread.waiting = []
			function final_action(succ) {
				let module_obj = loader_thread.module_obj
				if (! succ)
					module_obj = __new_obj('SystemExit', null)
				else
					module_obj.__importer = null 
				this_.loaded_modules.set(module_name, module_obj)
				for (let interrupt of loader_thread.waiting) {
					interrupt.runtime._interrupt_done(interrupt, module_obj)
				}
			}
			this.__prepare_module_importer(loader_thread, span, module_name)
			function report_ModuleNotFoundError(msg) {
				loader_thread.module_obj = __new_obj('ModuleNotFoundError', msg) 
				final_action(true)
			}
			let module_path = module_name.split('.')
			if (module_path.length == 1)
				module_path = module_path[0]+'.py'
			else
				module_path = module_path[0]+'/'+module_path[1]+'.py'
			function on_module_loaded(source_text) {
				let cur_thread_saved = this_.cur_thread
				this_.cur_thread = loader_thread
				loader_thread.module_obj.line = this_.__parse_module(module_name, source_text)
				this_.cur_thread = cur_thread_saved
				if (loader_thread.exit_val != null) {
					loader_thread.module_obj = loader_thread.exit_val.value
					final_action(true)
				}
				else {
					let module_obj = loader_thread.module_obj
					if (module_obj.line.children.length == 0)
						final_action(true)
					else {
						loader_thread.final_action = final_action
						this_.threads.push(loader_thread)
						if (this_.cur_thread == null)
							this_._loop()
					}
				}
			}
			function on_fetch_error(err_msg) {
				report_ModuleNotFoundError(err_msg)
			}
			this.load_module(this.import_base,module_path,on_module_loaded,on_fetch_error,on_fetch_error,on_fetch_error,on_fetch_error)
			wait_to_load(loader_thread)
		}
	}
	load_module(base,path,done,te404,ne200,te,ne) {
		function done_(text) {
			setTimeout(()=>{done(text)},0)
		}
		__fetch_text(base,path,done_,te404,ne200,te,ne)
	}
	__prepare_module_importer(thread, span, module_name, source_text) {
		let module_obj = __new_obj('module')
		module_obj.name = module_name
		module_obj.module_scope = new _Scope(null, null)
		module_obj.module_scope.loc = 'module '+module_name
		module_obj.module_scope.module_scope = module_obj.module_scope
		thread.span = span
		thread.func = module_obj
		thread.args = null
		thread.module_obj = module_obj
		module_obj.__importer = thread
		this.loaded_modules.set(module_name, module_obj)
		return module_obj
	}
	__new_function_thread(span, func, args) {
		let type_name = _type_name(func)
		if (type_name=='method') {
			args = [func.obj].concat(args)
			func = func.method
			type_name = _type_name(func)
		}
		if (type_name=='builtin_function_or_method') {
			return func.func(span, args, new Map())
		}
		else if (type_name!='function') {
			__raise_exception(span, __new_obj('TypeError', "Expect a function or method, but got a "+type_name))
			return null
		}
		let cur_thread = this._prepare_thread_for_call(span, null, func, args)
		if (cur_thread.exit_val!==null) {
			this.__print_stacktrace(cur_thread.exit_val.value)
			return null
		}
		this.threads.push(cur_thread)
		if (this.cur_thread===null)
			this._loop()
		return __new_obj('int', cur_thread.thread_id)
	}
	__parse_module(module_name, source_text) {
		let line = new Line()
		try {
			line.children = parse(source_text, module_name)
			for (let c of line.children)
				c.parent = line
			_read_ids(line)
			line = copy_convert(line)
		}
		catch (ex) {
			if (ex.constructor===SyntaxError) {
				__raise_exception(ex.span, __new_obj('SyntaxError', ex.message))
			}
			else if (ex.constructor===LexicalError) {
				__raise_exception(ex.span, __new_obj('LexicalError', ex.message))
			}
			else {
				console.error(ex.stack)
				__raise_exception(null, __new_obj('RuntimeError', ex.message))
			}
			return null
		}
		if (this.debug) {
			console.log('* module: '+module_name)
			console.log(_print_program(line.children))
		}
		return line
	}
	__format_exc(ex) {
		let cur_ex = this.cur_thread===null ? null : this.cur_thread.exit_val
		let prev_thread = this.cur_thread
		if (this.cur_thread===null) {
			this.cur_thread = new _Thread(this.next_thread_id+1)
			this.next_thread_id += 1
		}
		this.cur_thread.exit_val = null
		let err_msg = ''
		if ('prev_exit_val' in ex) {
			this.__print_stacktrace(ex.prev_exit_val)
			err_msg += '\nDuring handling of the above exception, another exception occurred:\n\n'
		}
		function span_info(s) {
			while (s.original!=null)
				s = s.original
			return '\tfile:'+s.file_nm+', line:'+(s.line_no+1)+', char:'+(s.char_start+1)+
					'\n\t\t'+s.get_text()
		}
		err_msg += 'Traceback (most recent call last):'
		for (let i = 0; i < ex.stack.length; ++ i) {
			let call_span = ex.stack[i]
			if (i==0 && call_span===null) continue
			if (call_span===undefined) continue 
			err_msg += '\n'+span_info(call_span)
		}
		if (ex.span!==undefined && ex.span!==null)
			err_msg += '\n'+span_info(ex.span)
		let ex_msg = __repr(ex.span, ex).value
		err_msg += '\n'+_type_name(ex)+(ex_msg.length>0?': '+ex_msg:'')+'\n\n'
		this.cur_thread = prev_thread
		if (this.cur_thread!==null)
			this.cur_thread.exit_val = cur_ex
		return err_msg
	}
	__print_stacktrace(ex) {
		let err_msg = this.__format_exc(ex)
		this.stderr(err_msg)
	}
	__cur_ex() {
		let t = this.cur_thread
		let ex = null
		if (t!==null) {
			if (t.exit_val!==null && t.exit_val.type=='exception')
				ex = t.exit_val.value
			else if (t.cur_ex!==null)
				ex = t.cur_ex
		}
		return ex
	}
	format_exc() {
		let ex = this.__cur_ex()
		if (ex===null)
			return 'NoneType: None\n'
		return this.__format_exc(ex)
	}
	__print_stacktrace_2() {
		let ex = __new_obj('RuntimeError', '')
		ex.stack = this.cur_thread.call_stack.slice(0)
		this.__print_stacktrace(ex)
	}
	_prepare_thread_for_call(span, modname_or_pyobj, func_or_name, argv) {
		let prev_thread = this.cur_thread
		let cur_thread = new _Thread(this.next_thread_id)
		this.next_thread_id += 1
		this.cur_thread = cur_thread
		let func = null
		let obj = null
		let module_name = null
		let func_name = null
		if (modname_or_pyobj!==null) {
			if (modname_or_pyobj.constructor===String)
				module_name = modname_or_pyobj
			else
				obj = modname_or_pyobj
			if (func_or_name.constructor===String)
				func_name = func_or_name
			else
				console.error('func_name is expected to be a string but got '+func_or_name.constructor.name)
		}
		else {
			if (func_or_name.constructor===String)
				func_name = func_or_name
			else {
				func = func_or_name
				func_name = '?'
			}
		}
		if (obj===null) {
			if (module_name===null) {
				if (func===null)
					func = cur_thread.cur_scope.get(func_name)
			}
			else {
				let module_obj = this.loaded_modules.get(module_name)
				if (module_obj!==null)
					func = module_obj.module_scope.vars.get(func_name)
			}
			if (func===undefined || func===null) {
				if (module_name!==null)
					func_name = module_name+'.'+func_name
				__raise_exception(span, __new_obj('NameError', "name '"+func_name+"' is not defined"))
				this.cur_thread = prev_thread
				return cur_thread
			}
		}
		else {
			let type = _type(obj)
			func = cur_thread.__getattr_1(span, obj, type, func_name)
			if (func == null) {
				__raise_exception(span, __new_obj('AttributeError', "'"+type.attr.get('__name__').value+"' object has no attribute '"+func_name+"'"))
				this.cur_thread = prev_thread
				return cur_thread
			}
		}
		argv = argv.map(e => __js2py(e, true))
		let call = __action_fun_call__handle_args_2(span, func, argv, new Map())
		if (cur_thread.exit_val != null) {
			this.cur_thread = prev_thread
			return cur_thread
		}
		func = call[0]
		argv = call[1]
		cur_thread.span = span
		cur_thread.func = func
		cur_thread.args = argv
		this.cur_thread = prev_thread
		return cur_thread
	}
	call_from_js(modname_or_pyobj, func_or_name, argv) {
		let cur_thread = this._prepare_thread_for_call(null, modname_or_pyobj, func_or_name, argv)
		if (cur_thread.exit_val!==null) {
			this.__print_stacktrace(cur_thread.exit_val.value)
			return null
		}
		let prev_thread_yield_interval = this.thread_yield_interval
		let prev_thread = this.cur_thread
		this.cur_thread = cur_thread
		this.thread_yield_interval = -1
		let ret_val = cur_thread.call(null, cur_thread.func, cur_thread.args)
		if (cur_thread.exit_val != null) {
			this.__print_stacktrace(cur_thread.exit_val.value)
			this.cur_thread = prev_thread
			if (this.cur_thread==null)
				this._loop()
			return null
		}
		ret_val = __py2js(null, ret_val)
		if (cur_thread.exit_val != null) {
			this.__print_stacktrace(cur_thread.exit_val.value)
			this.cur_thread = prev_thread
			if (this.cur_thread==null)
				this._loop()
			return null
		}
		this.cur_thread = prev_thread
		this.thread_yield_interval = prev_thread_yield_interval
		if (this.cur_thread==null)
			this._loop()
		return ret_val
	}
	to_python_object(obj) {
		return __new_obj('JSObject', obj)
	}
	is_python_object(obj) {
		return obj.constructor===__rt_object
	}
}
let runtime = new Runtime()
function split_lex_lines(spans) {
	let lex_lines = []
	let cur_line_no = -1
	let bracket_index = new Map([['[',0],['(',1],['{',2]])
	let closing_brackets = new Map([[']','['],[')','('],['}','{']])
	let open = [0,0,0]
	let prev_span = null
	for (let span of spans) {
		if (span.type == '$comment') continue
		if (span.line_no != cur_line_no || (prev_span!=null && prev_span.type=="':'")) {
			cur_line_no = span.line_no
			if (open[0]==0 && open[1]==0 && open[2]==0) {
				lex_lines.push([]) 
			}
		}
		lex_lines[lex_lines.length-1].push(span)
		if (bracket_index.has(span.text)) {
			open[bracket_index.get(span.text)] += 1
		}
		else if (closing_brackets.has(span.text)) {
			let index = bracket_index.get(closing_brackets.get(span.text))
			open[index] -= 1
			if (open[index] < 0)
				_report_lex_error('extra '+span.text, span.file_nm, span.line_no, span.char_start, span.text)
		}
		if (span.type == '$multitext' || span.type == '$formattext') {
			cur_line_no += span.text.split('\n').length-1
		}
		prev_span = span
	}
	return lex_lines
}
function match_lex_int(line, start) {
	for (let i = start; i < line.length; ++ i) {
		if (line[i] >= '0' && line[i] <= '9') continue;
		return i - start;
	}
	return line.length - start;
}
function match_lex_float(line, start) {
	let num_dot = 0;
	for (let i = start; i < line.length; ++ i) {
		if (line[i] == '.') {
			num_dot += 1;
			continue;
		}
		if (line[i] >= '0' && line[i] <= '9') continue;
		return i - start;
	}
	if (num_dot != 1) return 0;
	return line.length - start;
}
let op = new Set(['and', 'or', 'xor',
					'+', '-', '**', '*', '/', '%', '//', '~', '%', '^', '&', '@',
					'|', '>', '<', '>=', '<=', '==', '!=', '<<', '>>']);
function match_lex_op(line, start) {
	if (op.has(line.substring(start, start+3))) return 3;
	if (op.has(line.substring(start, start+2))) return 2;
	if (op.has(line.substring(start, start+1))) return 1;
	return 0;
}
function match_lex_id(line, start) {
	for (let i = start; i < line.length; ++ i) {
		if (i != start && line[i] >= '0' && line[i] <= '9') continue;
		if (line[i] == '_') continue;
		if (line[i] >= 'a' && line[i] <= 'z') continue;
		if (line[i] >= 'A' && line[i] <= 'Z') continue;
		if (line[i] > '\u00ff') continue;
		return i - start;
	}
	return line.length - start;
}
function match_lex_text(line, start) {
	let delimitor = null
	if (start + 3 < line.length) {
		let head = line.substring(start, start+3)
		if (head == "'''" || head == '"""') return 0
	}
	for (let i = start; i < line.length; ++ i) {
		if (i == start) {
			if (line[i] == '"' || line[i] == "'") {
				delimitor = line[i]
				continue
			}
		}
		else {
			if (line[i] == delimitor) {
				return i + 1 - start
			}
			if (line[i] == '\n') {
				return 0
			}
			if (line[i] == '\\') {
				if (i + 1 == line.length) return 0
				let c = line[i + 1]
				if (c == '\\' || c == "'" || c == '"' ||
					c == 'n' || c == 'r' || c == 't' || c == '\n') {
					++ i
					continue
				}
				else return 0
			}
			continue
		}
		return 0
	}
	return 0
}
function match_lex_multitext(line, start) {
	let delimitor = null
	if (start + 6 >= line.length) return 0
	let head = line.substring(start, start+3)
	if (head == "'''") delimitor = "'"
	if (head == '"""') delimitor = '"'
	if (delimitor == null) return 0
	for (let i = start + 5; i < line.length; ++ i) {
		if (line[i] != delimitor) continue
		if (line[i-1] != delimitor) continue
		if (line[i-2] != delimitor) continue
		return i+1-start;
	}
	return 0
}
function match_lex_formattext(line, start) {
	if (line[start]!='f') return 0
	let len = match_lex_text(line, start+1)
	if (len > 0) return len+1
	len = match_lex_multitext(line, start+1)
	if (len > 0) return len+1
	return 0
}
function match_lex_comment(line, start) {
	if (line.length <= start || line[start] != '#') return 0;
	for (let i = start + 1; i < line.length; ++ i) {
		if (line[i] == '\n') return i - start;
	}
	return line.length - start;
}
function simplify_exps(tree) {
}
function tree_reduce(lines, check_global) {
	let stack = []
	let trees = []
	for (let span of lines) {
		let line = new Line(span)
		span.parent = line
		if (line.span.char_start == 0)
			trees.push(line)
		let popped = false
		while (stack.length > 0 && stack[stack.length-1].span.char_start > line.span.char_start) {
			stack.pop()
			popped = true
		}
		let prev = null
		if (stack.length > 0)
			prev = stack[stack.length - 1]
		else {
			if (line.span.char_start > 0) report_indentation_error(line)
			stack.push(line)
			continue
		}
		let prev_prev = null
		if (stack.length > 1)
			prev_prev = stack[stack.length - 2]
		if (popped) {
			if (prev.span.char_start < line.span.char_start) report_indentation_error(line)
		}
		if (prev.span.char_start == line.span.char_start) {
			stack[stack.length - 1] = line
			if (prev_prev != null) {
				prev_prev.children.push(line)
				line.parent = prev_prev
			}
		}
		else {
			prev.children.push(line)
			line.parent = prev
			stack.push(line)
		}
	}
	if (check_global)
		for (let tree of trees)
			_check_py_indentation(tree)
	return trees
}
function _check_py_indentation(line) {
	let span = line.span
	let last_text = line.span.children[line.span.children.length-1].text
	if (line.children.length > 0)
		tree_format_assert(line, last_text==':', 'IndentationError: unexpected an indented block to follow this line')
	else {
		tree_format_assert(line, last_text!=':', 'IndentationError: expected an indented block to follow this line')
	}
	for (let c of line.children)
		_check_py_indentation(c)
}
function _act_tree_def(line) {
	let name = line.span.children[1].get_text();
	let func = __new_obj('function', null)
	func.name = name
	func.line = line
	func.module_scope = runtime.cur_thread.cur_scope.module_scope
	func.outer_scope = __get_outer_scope(runtime.cur_thread.cur_scope)
	func.param_info = {names:[],default_values:new Map(),wildcard:-1,kwargs:null}
	if  (line.span.children.length > 6)
		func.param_info.kwargs = line.span.children[6].get_text()
	if (line.span.children.length >= 6) {
		let params = line.span.children[3]
		for (let i in params.children) {
			let p = params.children[i]
			let name = null
			if (p.children.length == 1) {
				name = p.get_text()
			}
			else if (p.children.length == 2) {
				func.param_info.wildcard = i
				name = p.children[1].get_text()
			}
			else {
				name = p.children[0].get_text()
				let value = action(p.children[2])
				if (runtime.cur_thread.exit_val != null) return
				func.param_info.default_values.set(name, value)
			}
			if (func.param_info.names.indexOf(name) != - 1) {
				__raise_exception(line.span, __new_obj('SyntaxError', "duplicate argument '"+name+"' in function definition"))
				return
			}
			func.param_info.names.push(name)
		}
		if (func.param_info.kwargs != null) {
			if (func.param_info.names.indexOf(func.param_info.kwargs) != - 1) {
				__raise_exception(line.span, __new_obj('SyntaxError', "duplicate argument '"+name+"' in function definition"))
				return
			}
			func.param_info.names.push(func.param_info.kwargs)
		}
	}
	if (func.outer_scope == func.module_scope) func.outer_scope = null
	runtime.cur_thread.cur_scope.set(line.span, name, func)
}
function _act_tree_if_1(span, line) {
	let res = action(span)
	if (runtime.cur_thread.exit_val != null) return
	if (_type_name(res) != 'bool')
		__raise_exception(span, __new_obj('TypeError', 'Not a boolean'))
	else {
		if (res.value == true)
			runtime.cur_thread.run_block(line)
		if (runtime.cur_thread.exit_val == null)
			runtime.cur_thread.cur_scope.cur_block().else_val = !res.value
	}
}
function _act_tree_if(line) {
	let span = line.span.children[0].children[1]
	return _act_tree_if_1(span, line)
}
function _act_tree_else(line) {
	if (runtime.cur_thread.cur_scope.cur_block().else_val) {
		runtime.cur_thread.cur_ex = runtime.cur_thread.cur_scope.cur_block().ex_val
		runtime.cur_thread.exit_val = null
		runtime.cur_thread.run_block(line)
		if (runtime.cur_thread.exit_val == null) {
			runtime.cur_thread.cur_scope.cur_block().else_val = false
		}
	}
}
function _act_tree_try(line) {
	runtime.cur_thread.run_block(line)
	let has_ex = (runtime.cur_thread.exit_val != null && runtime.cur_thread.exit_val.type == 'exception')
	if (has_ex) {
		runtime.cur_thread.cur_scope.cur_block().else_val = true
		runtime.cur_thread.cur_scope.cur_block().ex_val = runtime.cur_thread.exit_val.value
	}
}
function _act_tree_except(line) {
	let ex_val  = runtime.cur_thread.cur_scope.cur_block().ex_val
	if (ex_val===null) return
	let ex_type = _type(ex_val)
	if (line.span.children.length >= 3) { 
		let children = line.span.children[1].children
		let ex_types = []
		let catched = false
		let base_ex = runtime.cur_thread.__get_class(line.span, 'BaseException')
		for (let c of children) {
			let catch_type = runtime.cur_thread.__get_class(c, c.get_text())
			if (catch_type===undefined) {
				__raise_exception(line.span, __new_obj('NameError', "'"+c.get_text()+"' is not defined"))
				return
			}
			let base_ex = runtime.cur_thread.__get_class(c, 'BaseException')
			if (! runtime.cur_thread.__issubclass(line.span, catch_type, base_ex)) {
				__raise_exception(line.span, __new_obj('TypeError', 'catching classes that do not inherit from BaseException is not allowed'))
				return
			}
			if (runtime.cur_thread.__issubclass(c, ex_type, catch_type))
				catched = true
		}
		if (! catched) return
		if (line.span.children.length == 5) {
			runtime.cur_thread.cur_scope.set(line.span, line.span.children[3].get_text(), ex_val)
		}
	}
	runtime.cur_thread.cur_ex = ex_val
	runtime.cur_thread.exit_val = null
	runtime.cur_thread.run_block(line)
	if (runtime.cur_thread.exit_val===null || runtime.cur_thread.exit_val.type!='interrupt') {
		runtime.cur_thread.cur_scope.cur_block().else_val = false
	}
}
function _act_tree_finally(line) {
	let ex_val = runtime.cur_thread.cur_scope.cur_block().ex_val
	runtime.cur_thread.cur_ex = ex_val
	runtime.cur_thread.exit_val = null
	runtime.cur_thread.run_block(line)
	if (runtime.cur_thread.exit_val == null)
		runtime.cur_thread.exit_val = ex_val
}
function __loop_condition() {
	if (runtime.cur_thread.exit_val == null) return true
	if (runtime.cur_thread.exit_val.type=='continue') {
		runtime.cur_thread.exit_val = null
		return true
	}
	else if (runtime.cur_thread.exit_val.type=='break') {
		runtime.cur_thread.exit_val = null
		runtime.cur_thread.cur_scope.cur_block().else_val = false
	}
	else if (runtime.cur_thread.exit_val.type=='exception' && _type_name(runtime.cur_thread.exit_val.value)=='StopIteration') {
		runtime.cur_thread.exit_val = null
		runtime.cur_thread.cur_scope.cur_block().else_val = true
	}
	return false
}
function _act_tree_while(line) {
	if (line.span.children[1].get_text() != 'True') {
		__raise_exception(line.span.children[1], __new_obj('SyntaxError', 'Only "True" is supported'))
		return
	}
	while (true) {
		_recover_from_thread_yield()
		runtime.cur_thread.run_block(line)
		if (! __loop_condition()) break
		if (_thread_yield()) break
	}
}
function _recover_from_thread_yield() {
	let t = runtime.cur_thread
	if (t.resume_val!=null) {
	 	if (t.resume_val.type=='thread_yield')
	 		if (t.cur_scope.block_level == t.cur_scope.block_info.length)
				t.resume_val = null
	}
}
function _thread_yield() {
	if (runtime.thread_yield_interval <= 0) return false
	let time = new Date().getTime()
	let t = runtime.cur_thread
	if (time - t.start_time > runtime.thread_yield_interval) {
		t.exit_val = {'type':'interrupt','value':{'type':'thread_yield'}}
		return true
	}
	return false
}
function __get_outer_scope() {
	let scope = runtime.cur_thread.cur_scope
	while (scope != null && 'class_scope' in scope)
		scope = scope.outer_scope
	return scope
}
function _act_tree_class(line) {
	let class_name = line.span.children[1].get_text()
	let super_classes = []
	if (line.span.children.length > 3)
		for (let c of line.span.children[3].children) {
			let cls = action(c)
			if (runtime.cur_thread.exit_val!==null) return
			if (_type_name(cls)!='type') {
				__raise_exception(c, __new_obj('TypeError', 'super class must be a type.'))
				return
			}
			super_classes.push(cls)
		}
	let cls = null
	if (runtime.cur_thread.resume_val == null) {
		cls = __new_obj('type')
		cls.name = class_name
		runtime.cur_thread.cur_scope.set(line.span, class_name, cls)
		cls.attr.set('__name__',__new_obj('str',class_name))
		cls.__super__ = super_classes
		cls.module_scope = new _Scope(runtime.cur_thread.cur_scope.module_scope, __get_outer_scope())
		cls.module_scope.class_scope = true
		cls.module_scope.loc = 'class '+class_name
		cls.module_scope.vars = cls.attr
		cls.line = line
	}
	else {
		cls = runtime.cur_thread.cur_scope.get(class_name)
	}
	runtime.cur_thread.__run_function(line.span, cls, null)
	for (let [k,v] of cls.attr) {
		if (_type_name(v) == 'function')
			v.name = class_name+'.'+v.name
	}
}
function __get_id_value(span) {
	let name = span.get_text()
	let v = runtime.cur_thread.cur_scope.get(name)
	if (v == null)
		__raise_exception(span, __new_obj('NameError', "name '"+name+"' is not defined"))
	return v
}
function _act_global(span) {
	for (let id_span of span.children[1].children) {
		let id = id_span.get_text()
		if (! runtime.cur_thread.cur_scope.bind_global(id)) {
			__raise_exception(id_span, __new_obj('SyntaxError', "name '"+id+"' is assigned to before global declaration"))
			break
		}
	}
}
function _act_nonlocal(span) {
	for (let id_span of span.children[1].children) {
		let id = id_span.get_text()
		if (runtime.cur_thread.cur_scope.__get_nonlocal(id) == null) {
			__raise_exception(id_span, __new_obj('SyntaxError', "no binding for nonlocal '"+id+"' found"))
			break
		}
		if (! runtime.cur_thread.cur_scope.bind_nonlocal(id)) {
			__raise_exception(id_span, __new_obj('SyntaxError', "name '"+id+"' is assigned to before nonlocal declaration"))
			break
		}
	}
}
function _act_pass(span) {
}
function _act_call(span) {
	func_args = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	return runtime.cur_thread.call(span, func_args[0], func_args[1])
}
function _act_import(span) {
	return _act_from_import(span)
}
function _act_from_dot_import(span) {
	return _act_from_import(span)
}
function _act_from_import(span) {
	let module_path = null
	let module_name = null
	if (span.children.length == 2) {
		module_name = span.children[1].get_text()
		module_path = module_name
	}
	else {
		module_name = span.children[3].get_text()
		module_path = span.children[1].get_text()
		if (module_path=='.')
			module_path = module_name
		else
			module_path = module_path+'.'+module_name
	}
	let module_obj = runtime.__import_module_interrupt(span, module_path)
	if (runtime.cur_thread.exit_val != null) return
	__assign(span, module_name, module_obj)
}
function _act_assign(span) {
	let lexp = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	let exp = action(span.children[2])
	if (runtime.cur_thread.exit_val != null) return
	if (exp===undefined)
		runtime.print_stacktrace()
	if (lexp.constructor.name != 'Array')
		lexp = [lexp]
	if (exp.constructor.name == 'Array')
		exp = __new_obj('tuple', exp)
	if (lexp.length == 1)
		__assign(span.children[0], lexp[0], exp)
	else {
		let values = __get_value_to_unpack(span.children[2], exp)
		if (runtime.cur_thread.exit_val != null) return
		__check_assign_lens(span.children[0], lexp, values)
		if (runtime.cur_thread.exit_val != null) return
		for (let i in lexp) {
			__assign(span.children[0].children[i], lexp[i], values[i])
			if (runtime.cur_thread.exit_val != null) return
		}
	}
}
function __assign(span, lexp, exp) {
	if (lexp.constructor.name == '__ItemExp')
		runtime.cur_thread.run_op(span, '[]=', [lexp.factor, lexp.exp, exp])
	else if (lexp.constructor.name == '__Attribute')
		runtime.cur_thread.setattr(span, lexp.obj, lexp.attr, exp)
	else if (lexp.constructor.name == 'String')
		runtime.cur_thread.cur_scope.set(span, lexp, exp)
	else
		__raise_exception(span, __new_obj('SyntaxError', "Not a valid LHS expression"))
}
function __get_value_to_unpack(val_span, val_exp) {
	let iter = runtime.cur_thread.run_method(val_span, _type(val_exp), '__iter__', [val_exp])
	if (runtime.cur_thread.exit_val!==null) return
	let arr = []
	while (true) {
		let next_value = runtime.cur_thread.run_method(val_span, _type(iter), '__next__', [iter])
		if (runtime.cur_thread.exit_val != null) {
			if (runtime.cur_thread.exit_val.type=='exception' && _type_name(runtime.cur_thread.exit_val.value)=='StopIteration') {
				runtime.cur_thread.exit_val = null
				break
			}
		}
		arr.push(next_value)
	}
	return arr
}
function __check_assign_lens(var_span, it_var, values) {
	if (it_var.length > values.length)
		__raise_exception(var_span, __new_obj('ValueError', "not enough values to unpack (expected "+it_var.length+", got "+values.length+")"))
	if (it_var.length < values.length)
		__raise_exception(var_span, __new_obj('ValueError', "too many values to unpack (expected "+it_var.length+", got "+values.length+")"))
}
function _act_assert_assert_exp(span) {
	let cond = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (_type_name(cond) != 'bool')
		__raise_exception(span.children[1], __new_obj('TypeError', 'bool condition is required'))
	if (cond.value == false)
		__raise_exception(span, __new_obj('AssertionError', ''))
}
function _act_assert_assert_exp_exp(span) {
	let cond = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (_type_name(cond) != 'bool')
		__raise_exception(span.children[1], __new_obj('TypeError', 'bool condition is required'))
	if (cond.value == true) return
	let repr = action(span.children[3])
	if (runtime.cur_thread.exit_val == null)
		repr = __repr(span.children[3], repr)
	if (runtime.cur_thread.exit_val == null)
		__raise_exception(span.children[1], __new_obj('AssertionError', repr.value))
	else if (runtime.cur_thread.exit_val.type=='exception')
		__raise_exception(span.children[1], __new_obj('AssertionError', '<exception str() failed>'))
}
function _act_return_exp(span) {
	if (runtime.cur_thread.cur_scope.module_scope === runtime.cur_thread.cur_scope)
		__raise_exception(span, __new_obj('SyntaxError', "'return' outside function"))
	let res = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (res.constructor.name == 'Array')
		res = __new_obj('tuple', res)
	runtime.cur_thread.exit_val = {'type':'return','span':span,'value':res}
}
function _act_return(span) {
	if (runtime.cur_thread.cur_scope.module_scope === runtime.cur_thread.cur_scope)
		__raise_exception(span, __new_obj('SyntaxError', "'return' outside function"))
	runtime.cur_thread.exit_val = {'type':'return','span':span,'value':__none}
}
function _act_yield_exp(span) {
	if (runtime.cur_thread.cur_scope.module_scope === runtime.cur_thread.cur_scope)
		__raise_exception(span, __new_obj('SyntaxError', "'yield' outside function"))
	if (runtime.cur_thread.resume_val == null) {
		let res = action(span.children[1])
		if (res.constructor.name == 'Array')
			res = __new_obj('tuple', res)
		runtime.cur_thread.exit_val = {'type':'yield','span':span,'value':res}
	}
	else {
		if (runtime.cur_thread.resume_val.type!='yield')
			__raise_exception(span, __new_obj('RuntimeError', "'yield' resume from: "+runtime.cur_thread.resume_val.type))
		runtime.cur_thread.resume_val = null
	}
}
function _act_raise_exp(span) {
	let res = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	let base_ex = runtime.cur_thread.__get_class(span, 'BaseException')
	if (! runtime.cur_thread.__issubclass(span, _type(res), base_ex))
		__raise_exception(span, __new_obj('TypeError', 'exceptions must derive from BaseException'))
	else
		__raise_exception(span, res)
}
function _act_raise(span) {
	let ex = runtime.__cur_ex()
	if (ex!==null)
		runtime.cur_thread.exit_val = {'type':'exception','value':ex}
	else
		__raise_exception(span, __new_obj('RuntimeError', 'No active exception to reraise'))
}
function _act_break(span) {
	runtime.cur_thread.exit_val = {'type':'break','span':span}
}
function _act_continue(span) {
	runtime.cur_thread.exit_val = {'type':'continue','span':span}
}
function _act_del_id(span) {
	let name = span.children[1].get_text()
	if (runtime.cur_thread.exit_val != null) return
	if (! runtime.cur_thread.cur_scope.del(span, name))
		__raise_exception(span, __new_obj('UnboundLocalError', "local variable '"+name+"' referenced before assignment"))
}
function _act_del_item_exp(span) {
	let item_exp = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	return runtime.cur_thread.run_op(span, 'del[]', [item_exp.factor, item_exp.exp])
}
function _act_factor_none(span) {
	return __none
}
function _act_factor_true(span) {
	return __new_obj('bool', true)
}
function _act_factor_false(span) {
	return __new_obj('bool', false)
}
function _act_factor_int(span) {
	let value = parseInt(span.get_text())
	return __new_obj('int', value)
}
function _act_factor_float(span) {
	let value = parseFloat(span.get_text())
	return __new_obj('float', value)
}
function _act_factor_id(span) {
	return __get_id_value(span)
}
function _action_binary_op(span, index) {
	let obj1 = action(span.children[index[0]])
	if (runtime.cur_thread.exit_val != null) return
	let obj2 = action(span.children[index[2]])
	if (runtime.cur_thread.exit_val != null) return
	let op = span.children[index[1]].get_text()
	return runtime.cur_thread.run_op(span, op, [obj1, obj2])
}
function _reverse_bool_value(span, exp, op) {
	if (_type_name(exp) != 'bool')
		__raise_exception(span, __new_obj('TypeError', 'A bool is expected from op: '+op))
	else {
		exp.value = !exp.value
		return exp
	}
}
function _act_factor_call(span) {
	let call = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	return runtime.cur_thread.call(span, call[0], call[1])
}
function _act_fun_call1(span) {
	return __action_fun_call__handle_args_1(span)
}
function _act_fun_call2(span) {
	return __action_fun_call__handle_args_1(span)
}
function _act_fun_call3(span) {
	return __action_fun_call__handle_args_1(span)
}
function __action_fun_call__handle_args_1(span) {
	let func = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	let func_name = func.name
	let argv = []
	let kwargs = new Map()
	seen_kwargs = false
	function set_kwargs(k,v) {
		seen_kwargs = true
		if (kwargs.has(k)) {
			__raise_exception(span, __new_obj('TypeError', func_name+"() got multiple values for argument '"+k+"'"))
			return
		}
		kwargs.set(k, v)
	}
	if (span.children.length > 3) {
		for (let arg of span.children[2].children) {
			if (arg.children.length == 1) {
				if (seen_kwargs) {
					__raise_exception(span, __new_obj('SyntaxError', "positional argument follows keyword argument"))
					return
				}
				let val = action(arg.children[0])
				if (runtime.cur_thread.exit_val != null) return
				argv.push(val)
			}
			else if (arg.children.length == 2) {
				if (arg.children[0].get_text() == '*') {
					let val = action(arg.children[1])
					val = __get_value_to_unpack(arg.children[1], val)
					for (let v of val) {
						argv.push(v)
					}
				}
				else {
					let dict = action(arg.children[1])
					if (_type_name(dict) != 'dict') {
						__raise_exception(span, __new_obj('TypeError', func_name+"() argument after ** must be a mapping, not "+_type_name(dict)))
						return
					}
					let items = runtime.cur_thread.run_method(arg.children[1], 'dict', 'items', [dict])
					for (let pair of items.value) {
						let key = pair.value[0]
						let val = pair.value[1]
						if (_type_name(key) != 'str') {
							__raise_exception(span, __new_obj('TypeError', func_name+"() keywords must be strings"))
							return
						}
						set_kwargs(key.value, val)
					}
				}
			}
			else {
				let key = arg.children[0].get_text()
				let val = action(arg.children[2])
				set_kwargs(key, val)
			}
		}
	}
	return __action_fun_call__handle_args_2(span, func, argv, kwargs)
}
function __action_fun_call__handle_args_2(span, func, argv, kwargs) {
	let obj = null
	let func_type_name = _type_name(func)
	if (func_type_name == 'type') {
		let obj = __new_obj(func, null)
		func = runtime.cur_thread.__getattr_1(span, obj, func, '__init__')
		func_type_name = _type_name(func)
	}
	if (func_type_name == 'method') {
		obj = func.obj
		func = func.method
	}
	else if (func_type_name != 'function' && func_type_name != 'builtin_function_or_method') {
		let __call__ = runtime.cur_thread.__getattr_1(span, null, _type(func), '__call__')
		if (__call__ == null) {
			__raise_exception(span, __new_obj('TypeError', "'"+func_type_name+"' object is not callable"))
			return
		}
		obj = func
		func = __call__.method
	}
	let func_name = func.name
	func_type_name = _type_name(func)
	if (obj != null)
		argv.unshift(obj)
	if (func_type_name == 'builtin_function_or_method') {
		argv.push(kwargs)
		return [func, argv]
	}
	let params = func.param_info.names
	let wildcard = func.param_info.wildcard
	let kwargs_name = func.param_info.kwargs
	let default_values = func.param_info.default_values
	if (kwargs_name != null)
		params.pop()
	let args = []
	for (let p of params)
		args.push(null)
	if (wildcard != -1)
		args[wildcard] = __new_obj('tuple', [])
	else
		if (argv.length > args.length) {
			__raise_exception(span, __new_obj('TypeError', func_name+"() takes "+args.length+" positional arguments but "+argv.length+" was given"))
			return
		}
	let arg_pos = 0
	for (let v of argv) {
		if (wildcard != -1 && arg_pos >= wildcard) {
			args[wildcard].value.push(v)
			continue
		}
		if (args[arg_pos] != null) {
			__raise_exception(span, __new_obj('TypeError', func_name+"() got multiple values for argument '"+params[arg_pos]+"'"))
			return
		}
		args[arg_pos] = v
		arg_pos += 1
	}
	let kwargs_dict = null
	if (kwargs_name != null) {
		kwargs_dict = __new_obj('dict', new Map())
		args.push(kwargs_dict)
	}
	for (let [k,v] of kwargs) {
		let pos = params.indexOf(k)
		if (pos != -1 && pos != wildcard) {
			if (args[pos] != null) {
				__raise_exception(span, __new_obj('TypeError', func_name+"() got multiple values for argument '"+params[arg_pos]+"'"))
				return
			}
			args[pos] = v
		}
		else {
			if (kwargs_name == null) {
				__raise_exception(span, __new_obj('TypeError', func_name+"() got an unexpected keyword argument '"+k+"'"))
				return
			}
			k = __new_obj('str', k)
			runtime.cur_thread.run_method(span, 'dict', '__setitem__', [kwargs_dict, k, v])
		}
	}
	if (kwargs_name != null)
		params.push(kwargs_name)
	for (let i in args) {
		if (args[i] == null) {
			if (default_values.has(params[i]))
				args[i] = default_values.get(params[i])
		}
		if (args[i] == null) {
			__raise_exception(span, __new_obj('TypeError', func_name+"() missing 1 required positional argument: '"+params[i]+"'"))
			return
		}
	}
	return [func, args]
}
function _act_factor_attribute(span) {
	let attr = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	return runtime.cur_thread.getattr(span, attr.obj, attr.attr)
}
function _act_attribute_id(span) {
	let obj = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	let attr_name = span.children[2].get_text()
	return new __Attribute(obj, attr_name)
}
class __Attribute
{
	constructor(obj, attr) {
		this.obj = obj
		this.attr = attr
	}
}
function _act_exp_if_exp_else_exp(span) {
	let cond = action(span.children[2])
	if (runtime.cur_thread.exit_val != null) return
	if (_type_name(cond) != 'bool')
		__raise_exception(span.children[2], __new_obj('TypeError', 'bool condition is required'))
	let exp_span = cond.value ? span.children[0] : span.children[4]
	return action(exp_span)
}
function _act_op(span) {
	return _action_binary_op(span, [0,1,2])
}
function _act_op_in(span) {
	return _action_binary_op(span, [2,1,0])
}
function _act_op_not_in(span) {
	let b = _action_binary_op(span, [3,2,0])
	if (runtime.cur_thread.exit_val != null) return
	return _reverse_bool_value(span, b, 'in')
}
function _act_op_is(span) {
	return _action_binary_op(span, [0,1,2])
}
function _action_binary_op_is_not(span) {
	let b = _action_binary_op(span, [0,1,3])
	if (runtime.cur_thread.exit_val != null) return
	return _reverse_bool_value(span, b, 'is')
}
function _action_unary_op(span) {
	let obj1 = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	let op = span.children[0].get_text()
	return runtime.cur_thread.run_op(span, op, [obj1])
}
function _act_star(span) {
	return _action_binary_op(span, [0,1,2])
}
function _act_star2(span) {
	return _action_binary_op(span, [0,1,2])
}
function _act_exp_op_1(span) {
	return _action_unary_op(span)
}
function _act_exp_op_not(span) {
	return _action_unary_op(span)
}
function _act_exp_r(span) {
	return action(span.children[1])
}
function _act_text(span) {
	return __new_obj('str', text_constant_to_text(span.get_text()))
}
function _act_multitext(span) {
	let text = span.get_text()
	text = text.substring(2, text.length - 2)
	text = text_constant_to_text(text)
	return __new_obj('str', text)
}
function _act_factor_item_exp(span) {
	let item_exp = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	return runtime.cur_thread.run_op(span, '[]', [item_exp.factor, item_exp.exp])
}
function _act_list(span) {
	let exps = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (exps.constructor.name != 'Array')
		exps = [exps]
	return __new_obj('list', exps)
}
function _act_list_2(span) {
	return _act_list(span)
}
function _act_list_empty(span) {
	return __new_obj('list', [])
}
function _act_tuple(span) {
	let exps = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (exps.constructor.name != 'Array')
		exps = [exps]
	exps.push(action(span.children[3]))
	if (runtime.cur_thread.exit_val != null) return
	return __new_obj('tuple', exps)
}
function _act_tuple_2(span) {
	return _act_tuple(span)
}
function _act_tuple_1(span) {
	return __new_obj('tuple', [action(span.children[1])])
}
function _act_tuple_empty(span) {
	return __new_obj('tuple', [])
}
function _act_set(span) {
	let value = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (value.constructor.name != 'Array')
		value = [value]
	let set = __new_obj('set', new Map())
	for (let p of value) {
		runtime.cur_thread.run_method(span, 'set', 'add', [set, p])
		if (runtime.cur_thread.exit_val != null) return
	}
	return set
}
function _act_set_2(span) {
	return _act_set(span)
}
function _act_dict_empty(span) {
	return __new_obj('dict', new Map())
}
function _act_dict(span) {
	let value = action(span.children[1])
	if (runtime.cur_thread.exit_val != null) return
	if (value.constructor.name != 'Array')
		value = [value]
	let dict = __new_obj('dict', new Map())
	for (let p of value) {
		runtime.cur_thread.run_method(span, 'dict', '__setitem__', [dict, p.key, p.val])
		if (runtime.cur_thread.exit_val != null) return
	}
	return dict
}
function _act_dict_2(span) {
	return _act_dict(span)
}
function _act_dict_item(span) {
	let exp1 = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	let exp2 = action(span.children[2])
	if (runtime.cur_thread.exit_val != null) return
	return new _DictItem(exp1, exp2)
}
class _DictItem {
	constructor(key, val) {
		this.key = key
		this.val = val
	}
};
function _act_lexp_id(span) {
	return span.children[0].get_text()
}
function _act_item_exp(span) {
	let exp1 = action(span.children[0])
	if (runtime.cur_thread.exit_val != null) return
	let exp2 = action(span.children[2])
	if (runtime.cur_thread.exit_val != null) return
	return new __ItemExp(exp1, exp2)
}
class __ItemExp {
	constructor(factor, exp) {
		this.factor = factor
		this.exp = exp
	}
}
let _global_id_counter = 0
let __builtins = new Map()
class _Type {
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'type.__init__()', objs, [2])) return
		objs[0] = _type(objs[1])
	}
	__repr__(span, objs) {
		return __new_obj('str', "<class '"+objs[0].attr.get('__name__').value+"'>")
	}
	__getattr__(span, objs, kwargs) {
		if (__assert_num_args(span,'type.__getattr__()', objs, [2])) return
		let attr_name = objs[1].value
		let t = runtime.cur_thread
		function getattr_in_super(type_obj) {
			let __super__ = t.__get_super_classes(type_obj)
			for (let super_obj of __super__) {
				if (super_obj.attr.get('__name__').value == 'object') return null
				if (super_obj.attr.has(attr_name))
					return super_obj.attr.get(attr_name)
				let res = getattr_in_super(super_obj)
				if (res!==null) return res
			}
			return null
		}
		return getattr_in_super(objs[0])
	}
}
class __rt_object {}
function __new_obj(type, value, span) {
	_global_id_counter += 1
	let obj = new __rt_object()
	obj.id = _global_id_counter
	obj.value = value
	obj.attr = new Map()
	if (type.constructor.name=='String' && __builtins.has(type))
		type = __builtins.get(type)
	obj.__class__ = type
	return obj
}
function _type(obj) {
	if (obj.constructor!==__rt_object) {
		console.error(obj)
		throw new Error('Expect a python object.')
	}
	if (! ('__class__' in obj)) {
		console.error(obj)
		throw new Error('Expect a python object with the __class__ attribute.')
	}
	let type = obj.__class__
	if (type.constructor.name == 'String' && __builtins.has(type)) {
		type = __builtins.get(type)
		obj.__class__ = type
	}
	return type
}
function _type_name(obj) {
	return _type(obj).attr.get('__name__').value
}
function __make_builtin_class(type, type_name) {
	let o = new type()
	let cls = __new_obj('type', null)
	cls.attr.set('__name__',__new_obj('str', type_name))
	if ('__super__' in o)
		cls.__super__ = o.__super__
	let p = Object.getPrototypeOf(o)
	let names = Object.getOwnPropertyNames(p);
	for (let n of names) {
		if (n == '__proto__' || n == 'constructor') continue
		if (o[n].constructor.name == 'Function') {
			let m = __new_obj('builtin_function_or_method', null)
			m.name = type_name+'.'+n
			m.func = o[n]
			cls.attr.set(n, m)
		}
	}
	return cls
}
class _builtin_function_or_method {}
class _class_method {}
class _class_function {}
class _class_module {
	__getattr__(span, objs) {
		let module_obj = objs[0]
		let name = objs[1].value
		if (module_obj.module_scope.vars.has(name))
			return module_obj.module_scope.vars.get(name)
	}
}
function __make_builtin_function(func, name) {
	let funct = __new_obj('builtin_function_or_method', null)
	funct.name = name
	funct.func = func
	return funct
}
class _Object
{
	__init__(span, objs, kwargs) {
		__assert_num_args(span,'object.__init__()', objs, [1])
	}
	__is__(span, objs) {
		return __new_obj('bool', objs[0].id == objs[1].id)
	}
	__hash__(span, objs) {
		return __new_obj('int', objs[0].id)
	}
	__repr__(span, objs) {
		return __new_obj('str', '<object of '+_type_name(objs[0])+' #'+objs[0].id+'>')
	}
	__eq__(span, objs) {
		let obj1 = objs[0]
		let obj2 = objs[1]
		return __new_obj('bool', obj1.id==obj2.id)
	}
	__ne__(span, objs) {
		let obj1 = objs[0]
		let obj2 = objs[1]
		return __new_obj('bool', obj1.id!=obj2.id)
	}
}
class _Super
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span, 'super()', objs, [3])) return
		let type = objs[1]
		if (__assert_type(span, type, 'type', 'super()')) return
		objs[0].__obj = objs[2]
		objs[0].__super = runtime.cur_thread.__get_super_classes(type)[0]
	}
}
class _BaseException
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'BaseException.__init__()', objs, [1,2])) return
		objs[0].value = ''
		if (objs.length == 2) {
			if (__assert_type(span, objs[1], 'str', 'BaseException.__init__')) return
			objs[0].value = objs[1].value
		}
	}
	__repr__(span, objs) {
		return __new_obj('str', objs[0].value)
	}
}
class _SystemExit { __super__=['BaseException'] }
class _KeyboardInterrupt { __super__=['BaseException'] }
class _GeneratorExit { __super__=['BaseException'] }
class _Exception { __super__=['BaseException'] }
class _StopIteration { __super__=['Exception'] }
class _StopAsyncIteration { __super__=['Exception'] }
class _ArithmeticError { __super__=['Exception'] }
class _FloatingPointError { __super__=['ArithmeticError'] }
class _OverflowError { __super__=['ArithmeticError'] }
class _ZeroDivisionError { __super__=['ArithmeticError'] }
class _AssertionError { __super__=['Exception'] }
class _AttributeError { __super__=['Exception'] }
class _BufferError { __super__=['Exception'] }
class _EOFError { __super__=['Exception'] }
class _ImportError { __super__=['Exception'] }
class _ModuleNotFoundError { __super__=['ImportError'] }
class _LookupError { __super__=['Exception'] }
class _IndexError { __super__=['LookupError'] }
class _KeyError { __super__=['LookupError'] }
class _MemoryError { __super__=['Exception'] }
class _NameError { __super__=['Exception'] }
class _UnboundLocalError { __super__=['NameError'] }
class _OSError { __super__=['Exception'] }
class _BlockingIOError { __super__=['OSError'] }
class _ChildProcessError { __super__=['OSError'] }
class _ConnectionError { __super__=['OSError'] }
class _BrokenPipeError { __super__=['ConnectionError'] }
class _ConnectionAbortedError { __super__=['ConnectionError'] }
class _ConnectionRefusedError { __super__=['ConnectionError'] }
class _ConnectionResetError { __super__=['ConnectionError'] }
class _FileExistsError { __super__=['OSError'] }
class _FileNotFoundError { __super__=['OSError'] }
class _InterruptedError { __super__=['OSError'] }
class _IsADirectoryError { __super__=['OSError'] }
class _NotADirectoryError { __super__=['OSError'] }
class _PermissionError { __super__=['OSError'] }
class _ProcessLookupError { __super__=['OSError'] }
class _TimeoutError { __super__=['OSError'] }
class _ReferenceError { __super__=['Exception'] }
class _RuntimeError { __super__=['Exception'] }
class _NotImplementedError { __super__=['RuntimeError'] }
class _RecursionError { __super__=['RuntimeError'] }
class _SyntaxError { __super__=['Exception'] }
class _LexicalError { __super__=['Exception'] }
class _IndentationError { __super__=['SyntaxError'] }
class _TabError { __super__=['IndentationError'] }
class _SystemError { __super__=['Exception'] }
class _TypeError { __super__=['Exception'] }
class _ValueError { __super__=['Exception'] }
class _UnicodeError { __super__=['ValueError'] }
class _UnicodeDecodeError { __super__=['UnicodeError'] }
class _UnicodeEncodeError { __super__=['UnicodeError'] }
class _UnicodeTranslateError { __super__=['UnicodeError'] }
class _Warning { __super__=['Exception'] }
class _DeprecationWarning { __super__=['Warning'] }
class _PendingDeprecationWarning { __super__=['Warning'] }
class _RuntimeWarning { __super__=['Warning'] }
class _SyntaxWarning { __super__=['Warning'] }
class _UserWarning { __super__=['Warning'] }
class _FutureWarning { __super__=['Warning'] }
class _ImportWarning { __super__=['Warning'] }
class _UnicodeWarning { __super__=['Warning'] }
class _BytesWarning { __super__=['Warning'] }
class _ResourceWarning { __super__=['Warning'] }
class _NoneType
{
	__repr__(span, objs) {
		return __new_obj('str', 'None')
	}
}
class _Generator {
	__iter__(span, args) {
		if (__assert_num_args(span,'generator.__iter__()', args, [1])) return
		if (runtime.cur_thread.exit_val != null) return
		return args[0]
	}
	__next__(span, args) {
		if (__assert_num_args(span,'generator.__next__()', args, [1])) return
		if (runtime.cur_thread.exit_val != null) return
		let generator_obj = args[0]
		if (generator_obj.yield_value != null) {
			let yield_value = generator_obj.yield_value
			generator_obj.yield_value = null
			return yield_value
		}
		let res = __resume_generator(span, generator_obj)
		if (runtime.cur_thread.exit_val != null) return
		if (res == null) {
			__raise_exception(span, __new_obj('StopIteration', ''))
			return
		}
		return res
	}
}
function __resume_generator(span, generator_obj) {
	let thread = runtime.cur_thread
	if (thread.resume_val == null) {
		thread.resume_val = {'type':'yield'}
		thread.call_stack.push(generator_obj.span)
		thread.local_stack.push(generator_obj.cur_scope)
	}
	thread.cur_scope = thread.local_stack[thread.stack_size]
	++ thread.stack_size
	thread.cur_scope.block_level = 0
	thread.run_block(generator_obj.line)
	return thread.__leave_function('yield')
}
class _Int
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'int.__init__()', objs, [1,2])) return
		if (objs.length == 1)
			objs[0].value = 0
		else {
			if (__assert_type(span, objs[1], ['int','float','str'], 'int.__init__()')) return
			if (_type_name(objs[1]) == 'str') {
				objs[0].value = parseInt(objs[1].value)
				if (isNaN(objs[0].value))
					__raise_exception(span, __new_obj('ValueError', "invalid literal for int() with base 10: '"+objs[1].value+"'"))
			}
			else {
				if (__assert_num(span, objs[1])) return
				objs[0].value = Math.floor(objs[1].value)
			}
		}
	}
	__hash__(span, objs) {
		return __new_obj('int', objs[0].value)
	}
	__neg__(span, objs) {
		return __new_obj('int', -objs[0].value)
	}
	__pos__(span, objs) {
		return __new_obj('int', objs[0].value)
	}
	__repr__(span, objs) {
		return __new_obj('str', ''+objs[0].value)
	}
	__add__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj(_type(objs[1]), objs[0].value+objs[1].value)
	}
	__sub__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj(_type(objs[1]), objs[0].value-objs[1].value)
	}
	__mul__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj(_type(objs[1]), objs[0].value*objs[1].value)
	}
	__floordiv__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('int', Math.floor(objs[0].value/objs[1].value))
	}
	__truediv__(span, objs, kwargs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('float', objs[0].value/objs[1].value)
	}
	__pow__(span, objs) {
		if (__assert_num(span, objs[1])) return
		if (_type_name(objs[1]) == 'int')
			return __new_obj('int', Math.floor(Math.pow(objs[0].value,objs[1].value)))
		else
			return __new_obj('float', Math.pow(objs[0].value,objs[1].value))
	}
	__invert__(span, objs) {
		return __new_obj('int', ~objs[0].value)
	}
	__and__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '&')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('int', objs[0].value&objs[1].value)
	}
	__xor__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '^')) return
		return __new_obj('int', objs[0].value^objs[1].value)
	}
	__or__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '|')) return
		return __new_obj('int', objs[0].value|objs[1].value)
	}
	__lshift__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '<<')) return
		return __new_obj('int', objs[0].value<<objs[1].value)
	}
	__mod__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '%')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('int', objs[0].value%objs[1].value)
	}
	__rshift__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '>>')) return
		return __new_obj('int', objs[0].value>>objs[1].value)
	}
	__lt__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('bool', objs[0].value<objs[1].value)
	}
	__gt__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('bool', objs[0].value>objs[1].value)
	}
	__le__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('bool', objs[0].value<=objs[1].value)
	}
	__ge__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('bool', objs[0].value>=objs[1].value)
	}
	__eq__(span, objs) {
		if (!__is_num(objs[1]))
			return __new_obj('bool',false)
		return __new_obj('bool', objs[0].value==objs[1].value)
	}
	__ne__(span, objs) {
		if (!__is_num(objs[1]))
			return __new_obj('bool',true)
		return __new_obj('bool', objs[0].value!=objs[1].value)
	}
}
class _Float
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'float.__init__()', objs, [1,2])) return
		if (objs.length == 1)
			objs[0].value = 0
		else if (_type_name(objs[1]) == 'str') {
			if (objs[1].value=='inf')
				objs[0].value = Infinity
			else if (objs[1].value=='-inf')
				objs[0].value = -Infinity
			else
				objs[0].value = parseFloat(objs[1].value)
		}
		else {
			if (__assert_num(span, objs[1])) return
			objs[0].value = objs[1].value
		}
	}
	__neg__(span, objs) {
		return __new_obj('float', -objs[0].value)
	}
	__pos__(span, objs) {
		return __new_obj('float', objs[0].value)
	}
	__repr__(span, objs) {
		if (objs[0].value==Infinity)
			return __new_obj('str', 'inf')
		if (objs[0].value==-Infinity)
			return __new_obj('str', '-inf')
		if (objs[0].value==Number.NaN)
			return __new_obj('str', 'NaN')
		return __new_obj('str', ''+objs[0].value)
	}
	__add__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('float', objs[0].value+objs[1].value)
	}
	__sub__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj(_type(objs[1]), objs[0].value-objs[1].value)
	}
	__mul__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj(_type(objs[1]), objs[0].value*objs[1].value)
	}
	__floordiv__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('int', Math.floor(objs[0].value/objs[1].value))
	}
	__truediv__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('float', objs[0].value/objs[1].value)
	}
	__pow__(span, objs) {
		if (__assert_num(span, objs[1])) return
		return __new_obj('float', Math.pow(objs[0].value,objs[1].value))
	}
	__lt__(span, objs) {
		if (__assert_num(span, objs[1])) return
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value<objs[1].value)
	}
	__gt__(span, objs) {
		if (__assert_num(span, objs[1])) return
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value>objs[1].value)
	}
	__le__(span, objs) {
		if (__assert_num(span, objs[1])) return
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value<=objs[1].value)
	}
	__ge__(span, objs) {
		if (__assert_num(span, objs[1])) return
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value>=objs[1].value)
	}
	__eq__(span, objs) {
		if (!__is_num(objs[1]))
			return __new_obj('bool',false)
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value==objs[1].value)
	}
	__ne__(span, objs) {
		if (!__is_num(objs[1]))
			return __new_obj('bool',true)
		if (objs[0].value==Number.NaN) return false
		return __new_obj('bool', objs[0].value!=objs[1].value)
	}
}
class _Bool
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'bool.__init__()', objs, [1,2])) return
		if (objs.length == 1)
			objs[0].value = false
		else if (_type_name(objs[1]) == 'str')
			objs[0].value = (objs[1].value == 'True')
		else {
			let b = runtime.cur_thread.run_method(span, _type(objs[1]), '__truth__', [objs[1]])
			if (runtime.cur_thread.exit_val != null) return
			if (__assert_ret_type(span, b, 'bool', _type_name(objs[1])+'.__truth__')) return
			objs[0].value = b.value
		}
	}
	__not__(span, objs) {
		let obj1 = objs[0]
		return __new_obj('bool', !objs[0].value)
	}
	__eq__(span, objs) {
		if (_type_name(objs[1]) != 'bool')
			return __new_obj('bool', false)
		return __new_obj('bool', objs[0].value==objs[1].value)
	}
	__ne__(span, objs) {
		if (_type_name(objs[1]) != 'bool')
			return __new_obj('bool', true)
		return __new_obj('bool', objs[0].value!=objs[1].value)
	}
	__lt__(span, objs) {
		if (__assert_bool(span, objs[1])) return
		return __new_obj('bool', objs[0].value<objs[1].value)
	}
	__gt__(span, objs) {
		if (__assert_bool(span, objs[1])) return
		return __new_obj('bool', objs[0].value>objs[1].value)
	}
	__le__(span, objs) {
		if (__assert_bool(span, objs[1])) return
		return __new_obj('bool', objs[0].value<=objs[1].value)
	}
	__ge__(span, objs) {
		if (__assert_bool(span, objs[1])) return
		return __new_obj('bool', objs[0].value>=objs[1].value)
	}
	__repr__(span, objs) {
		return __new_obj('str', objs[0].value?'True':'False')
	}
	__is__(span, objs) {
		return __new_obj('bool', objs[0].value === objs[1].value)
	}
}
function __ispyobj(obj) {
	return obj.constructor===__rt_object
}
function __py2js(span, val) {
	let type_name = _type_name(val)
	if (type_name == 'NoneType') return null
	if (['int','str','float','bool'].indexOf(type_name) != -1) return val.value
	if (['list','tuple'].indexOf(type_name) != -1) {
		let arr = []
		for (let e of val.value)
			arr.push(__py2js(span, e))
		return arr
	}
	if (type_name == 'dict') {
		let items = runtime.cur_thread.run_method(span, 'dict', 'items', [val])
		let map = {}
		for (let pair of items.value)
			map[__py2js(span, pair.value[0])] = __py2js(span, pair.value[1])
		return map
	}
	if (__callable(span, val)) {
		return function() {
			return runtime.call_from_js(null, val, Array.from(arguments))
		}
	}
	if (type_name == 'JSObject')
		return val.value
	if (__ispyobj(val))
		return val
	__raise_exception(span, __new_obj('TypeError', 'Cannot convert to Javascript data: '+type_name))
}
function __js2py(obj, jsobj2dict) {
	function to_py_obj(val) {
		if (val === undefined || val == null) return __none
		if (val.constructor.name == 'Boolean') return __new_obj('bool', val)
		if (val.constructor.name == 'String') return __new_obj('str', val)
		if (val.constructor.name == 'Number') {
			if (val==Infinity || val==-Infinity || val==Number.NaN)
				return __new_obj('float', val)
			if (Math.floor(val) == val)
				return __new_obj('int', val)
			return __new_obj('float', val)
		}
		if (val.constructor.name == 'Array') {
			let ll = []
			for (let o of val)
				ll.push(to_py_obj(o))
			let res = __new_obj('list', ll)
			return res
		}
		if (val.constructor.name == 'Map') {
			let d = __new_obj('dict', new Map())
			for (const [key, value] of val) {
				if (value.constructor.name == 'Function') continue
				new _Dict().__setitem__(null, [d, to_py_obj(key), to_py_obj(value)])
			}
			return d
		}
		if (__ispyobj(val))
			return val
		if (jsobj2dict) {
			let d = __new_obj('dict', new Map())
			for (let n in val) {
				if (! val.hasOwnProperty(n)) continue
				if (n == '__proto__' || n == 'constructor' || n == '__uniqueid') continue
				if (val[n].constructor.name == 'Function') continue
				new _Dict().__setitem__(null, [d, to_py_obj(n), to_py_obj(val[n])])
			}
			return d
		}
		return __new_obj('JSObject', obj)
	}
	return to_py_obj(obj)
}
function __call(span, objs, _new) {
	let func_obj = objs.shift()
	let func = func_obj.value
	for (let i in objs)
		objs[i] = __py2js(span, objs[i])
	let res = null
	try {
		if (func.constructor.name == 'Function') {
			if (_new) {
				res = new func(...objs)
			}
			else {
				if ('obj' in func_obj) {
					res = func.call(func_obj['obj'], ...objs)
				}
				else
					res = func(...objs)
			}
		}
		else {
			__raise_exception(span, __new_obj('ValueError', span.text+'('+func.constructor.name+') is not callable'))
			return
		}
	}
	catch (ex) {
		console.error(ex)
		__raise_exception(span, __new_obj('ValueError', ex.message))
		return
	}
	if (res === undefined) res = null
	return __new_obj('JSObject', res)
}
class _JSObject
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'JSObject.__init__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'str', 'JSObject.__init__')) return
		try {
			objs[0].value = eval(objs[1].value)
		}
		catch (ex) {
			console.error(ex.stack)
			__raise_exception(span, __new_obj('ValueError', ex.message))
			return
		}
		if (objs[0].value === undefined)
			__raise_exception(span, __new_obj('ValueError', objs[1].value+' is undefined'))
	}
	__repr__(span, objs) {
		if (__assert_num_args(span,'JSObject.__repr__()', objs, [1])) return
		let name = (objs[0].value==null?'null':objs[0].value.constructor.name)
		return __new_obj('str', "<JSObject '"+name+"'>")
	}
	__dir__(span, objs) {
		let obj = objs[0].value
		let keys = []
		if (obj!==undefined && obj!==null)
			keys = Object.keys(obj)
		return __js2py(__new_obj('JSObject', keys))
	}
	__hasattr__(span, objs) {
		if (__assert_num_args(span,'JSObject.__hasattr__()', objs, [2])) return
		let obj = objs[0].value
		let attr = objs[1].value
		let has = false
		if (obj===undefined || obj===null || attr===undefined || attr===null)
			has = Reflect.has(obj, attr)
		return __new_obj('bool', has)
	}
	__getattr__(span, objs) {
		if (__assert_num_args(span,'JSObject.__getattr__()', objs, [2])) return
		let obj = objs[0]
		let attr = objs[1].value
		if (obj.value === undefined) {
			try {
				return __new_obj('JSObject', eval(attr))
			}
			catch (ex) {
				__raise_exception(span, __new_obj('ValueError', ex.message))
				return
			}
		}
		obj = obj.value
		if (obj===null) {
			__raise_exception(span, __new_obj('ValueError', 'Accessing attributes of JSObject "null"'))
			return
		}
		if (obj.constructor===String || obj.constructor===Number || obj.constructor===Boolean) {
			__raise_exception(span, __new_obj('ValueError', 'Accessing attributes in basic types is not supported'))
			return
		}
		if (attr in obj) {
			let ret = __new_obj('JSObject', obj[attr])
			ret.obj = obj
			return ret
		}
	}
	__setattr__(span, objs) {
		if (__assert_num_args(span,'JSObject.__setattr__()', objs, [3])) return
		let obj = objs[0].value
		let attr = objs[1].value
		if (obj===undefined) {
			window[attr] = __py2js(span, objs[2])
			return
		}
		if (obj.constructor===String || obj.constructor===Number || obj.constructor===Boolean) {
			__raise_exception(span, __new_obj('ValueError', 'Accessing attributes in basic types is not supported'))
		}
		obj[attr] = __py2js(span, objs[2])
		return __none
	}
	__getitem__(span, objs) {
		return new _JSObject().__getattr__(span, objs)
	}
	__setitem__(span, objs) {
		return new _JSObject().__setattr__(span, objs)
	}
	new(span, objs, kwargs) {
		return __call(span, objs, true)
	}
	__call__(span, objs, kwargs) {
		return __call(span, objs, false)
	}
	data(span, objs, kwargs) {
		if (__assert_num_args(span,'JSObject.data()', objs, [1])) return
		let res = __js2py(objs[0].value, true)
		return res
	}
	bind(span, objs, kwargs) {
		if (__assert_num_args(span, 'JSObject.bind()', objs, [3])) return
		if (__assert_type(span, objs[1], 'str', 'JSObject.__getattr__')) return
		let obj = objs[0].value
		let name = objs[1].value
		let func = objs[2]
		if (! __callable(span, func)) {
			__raise_exception(span, __new_obj('ValueError', 'The second argument is not callable'))
			return
		}
		function add_listener(obj1) {
			function func_wrapper(ev) {
				runtime.__new_function_thread(span, func, [__new_obj('JSObject',ev)])
			}
			obj['on'+name] = func_wrapper
		}
		if (0 in obj)
			obj = obj[0]
		add_listener(obj)
	}
}
let __none = __new_obj('NoneType',null)
__builtins.set('javascript', __new_obj('JSObject'))
class _Slice
{
	__init__(span, objs, kwargs) {
		let obj = objs[0]
		__assert_num_args(span,'slice.__init__()', objs, [4])
		let args = objs.slice(1)
		for (let arg of args)
			__assert_type(span, arg, ['int','NoneType'], 'slice.__init__()')
		obj.attr.set('start', args[0])
		obj.attr.set('stop', args[1])
		obj.attr.set('step', args[2])
	}
	__repr__(span, objs) {
		let obj = objs[0]
		let start = obj.attr.get('start').value
		let stop = obj.attr.get('stop').value
		let step = obj.attr.get('step').value
		if (step==0) {
			__raise_exception(span, __new_obj('ValueError', 'slice step cannot be zero'))
			return
		}
		if (start===null) start = 'None'
		if (stop===null) stop = 'None'
		if (step===null) step = 'None'
		let repr = 'slice('+start+','+stop+','+step+')'
		return __new_obj('str', repr)
	}
}
function __slice_data(size,slice) {
	let start = slice.attr.get('start').value
	let stop = slice.attr.get('stop').value
	let step = slice.attr.get('step').value
	if (start==null && stop===null && step===null)
		return [0,size,1]
	if (start==null && stop===null) {
		if (step < 0)
			return [size-1, -1, step]
		else
			return [0, size, step]
	}
	if (start==null && step===null) {
		if (stop<0) stop = size+stop
		return [0,stop,1]
	}
	if (stop==null && step===null) {
		if (start<0) start = size+start
		return [start,size,1]
	}
	if (step===null) {
		if (start<0) start = size+start
		if (stop<0) stop = size+stop
		return [start,stop,1]
	}
	if (start===null) {
		if (step>0) return [0,stop,step]
		return [size,stop,step]
	}
	if (stop===null) {
		if (step>0) return [start,size,step]
		return [start,-1,step]
	}
	if (start<0) start = size+start
	if (stop<0) stop = size+stop
	return [start,stop,step]
}
function __slice_indexes(start,stop,step) {
	let idx = []
	if (start<stop && step>0) {
		for (let i = start; i < stop; i += step)
			idx.push(i)
	}
	if (start>stop && step<0) {
		for (let i = start; i > stop; i += step) {
			idx.push(i)
		}
	}
	return idx
}
class _Str
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span,'str.__init__()', objs, [1,2])) return
		if (objs.length == 1)
			objs[0].value = ''
		else {
			let repr = __repr(span, objs[1])
			if (runtime.cur_thread.exit_val===null)
				objs[0].value = repr.value
		}
	}
	__iter__(span, objs) {
		let chars = []
		for (let c of objs[0].value)
			chars.push(__new_obj('str', c))
		return __new_obj('_iterator', [0,chars.length,chars])
	}
	__len__(span, objs) {
		return __new_obj('int', objs[0].value.length)
	}
	split(span, objs, kwargs) {
		if (__assert_num_args(span,'str.split()', objs, [1,2])) return
		let delimitor = /\s+/
		if (objs.length == 2) {
			if (__assert_type(span, objs[1], 'str', 'str.split()')) return
			delimitor = objs[1].value
		}
		let values = objs[0].value.split(delimitor)
		if (values.length>0 && values[0]=='')
			values = values.slice(1)
		if (values.length>0 && values[values.length-1]=='')
			values = values.slice(0,-1)
		for (let i in values)
			values[i] = __new_obj('str', values[i])
		return __new_obj('list', values)
	}
	join(span, objs, kwargs) {
		if (__assert_num_args(span,'str.join()', objs, [2])) return
		let data = __new_obj('list', [])
		__values_from_iter(span, 'str.join()', [data, objs[1]])
		data = data.value
		if (data.length==0) return __new_obj('str', '')
		for (let i in data) {
			if (_type_name(data[i]) != 'str') {
				__raise_exception(span, __new_obj('TypeError', 'sequence item '+i+': expected str instance, '+_type_name(data[i])+' found'))
				return
			}
		}
		let text = data[0].value
		for (let i=1; i < data.length; ++ i)
			text += objs[0].value+data[i].value
		return __new_obj('str', text)
	}
	replace(span, objs, kwargs) {
		if (__assert_num_args(span,'str.join()', objs, [3, 4])) return
		let obj = objs[0]
		let fr = objs[1]
		let to = objs[2]
		if (__assert_type(span, fr, 'str', 'str.replace()')) return
		if (__assert_type(span, to, 'str', 'str.replace()')) return
		let count = null
		if (objs.length == 4) {
			count = objs[3]
			if (__assert_type(span, count, 'int', 'str.replace()')) return
			count = count.value
		}
		let res = obj.value
		if (count == null)
			return __new_obj('str', res.replaceAll(fr.value,to.value))
		for (let i = 0; i < count; ++ i)
			res = res.replace(fr.value,to.value)
		return __new_obj('str', res)
	}
	lstrip(span, objs, kwargs) {
		if (__assert_num_args(span,'str.lstrip()', objs, [1])) return
		let obj = objs[0]
		let i = 0
		while (i < obj.value.length)
			if (obj.value[i]==' '||obj.value[i]=='\t'||obj.value[i]=='\r'||obj.value[i]=='\n')
				++ i
			else
				break
		return __new_obj('str', obj.value.substring(i))
	}
	rstrip(span, objs, kwargs) {
		if (__assert_num_args(span,'str.rstrip()', objs, [1])) return
		let obj = objs[0]
		let i = obj.value.length-1
		while (i > 0)
			if (obj.value[i]==' '||obj.value[i]=='\t'||obj.value[i]=='\r'||obj.value[i]=='\n')
				-- i
			else
				break
		return __new_obj('str', obj.value.substring(0,i+1))
	}
	strip(span, objs, kwargs) {
		if (__assert_num_args(span,'str.strip()', objs, [1])) return
		let s = new _Str()
		let o = objs[0]
		o = s.lstrip(span, [o], null)
		return s.rstrip(span, [o], null)
	}
	count(span, objs, kwargs) {
		if (__assert_num_args(span,'str.count()', objs, [2])) return
		let obj = objs[0]
		let pat = objs[1]
		if (__assert_type(span, pat, 'str', 'str.count()')) return
		obj = obj.value
		pat = pat.value
		let c = 0
		let s = 0
		while (true) {
			let i = obj.indexOf(pat,s)
			if (i == -1) break
			s = i+1
			c += 1
		}
		return __new_obj('int', c)
	}
	capitalize(span, objs, kwargs) {
		if (__assert_num_args(span,'str.count()', objs, [1])) return
		let text = objs[0].value
		if (text.length==0) return __new_obj('str', '')
		return __new_obj('str', text[0].toUpperCase()+text.substring(1))
	}
	lower(span, objs, kwargs) {
		if (__assert_num_args(span,'str.lower()', objs, [1])) return
		let text = objs[0].value
		return __new_obj('str', text.toLowerCase())
	}
	upper(span, objs, kwargs) {
		if (__assert_num_args(span,'str.upper()', objs, [1])) return
		let text = objs[0].value
		return __new_obj('str', text.toUpperCase())
	}
	__contains__(span, objs) {
		let obj = objs[0]
		let obj2 = objs[1]
		if (__assert_type(span, obj2, 'str', 'str.__contains__()')) return
		return __new_obj('bool', obj.value.indexOf(obj2.value)!=-1)
	}
	index(span, objs) {
		if (__assert_num_args(span,'str.index()', objs, [2])) return
		let obj = objs[0]
		let obj2 = objs[1]
		if (__assert_type(span, obj2, 'str', 'str.index()')) return
		return __new_obj('int', obj.value.indexOf(obj2.value))
	}
	__hash__(span, objs) {
		let v = objs[0].value
		let h = 0, c
		for (let i = 0; i < v.length; ++ i) {
			c = v.charCodeAt(i)
			h = ((c << 5) - h) + c
			h |= 0
		}
		return __new_obj('int', h)
	}
	__add__(span, objs) {
		if (__assert_type(span, objs[1], 'str', '+')) return
		return __new_obj('str', objs[0].value+objs[1].value)
	}
	__mul__(span, objs) {
		if (__assert_type(span, objs[1], 'int', '*')) return
		let text = ''
		for (let i = 0; i < objs[1].value; ++ i)
			text += objs[0].value
		return __new_obj('str', text)
	}
	__repr__(span, objs) {
		return objs[0]
	}
	__lt__(span, objs) {
		if (__assert_type(span, objs[1], 'str', '<')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('bool', objs[0].value<objs[1].value)
	}
	__gt__(span, objs) {
		if (__assert_type(span, objs[1], 'str', '>')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('bool', objs[0].value>objs[1].value)
	}
	__le__(span, objs) {
		if (__assert_type(span, objs[1], 'str', '<=')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('bool', objs[0].value<=objs[1].value)
	}
	__ge__(span, objs) {
		if (__assert_type(span, objs[1], 'str', '>=')) return
		if (runtime.cur_thread.exit_val != null) return
		return __new_obj('bool', objs[0].value>=objs[1].value)
	}
	__eq__(span, objs) {
		if (! _type_name(objs[1]) == 'str')
			return __new_obj('bool', false)
		return __new_obj('bool', objs[0].value==objs[1].value)
	}
	__ne__(span, objs) {
		if (! _type_name(objs[1]) == 'str')
			return __new_obj('bool', true)
		return __new_obj('bool', objs[0].value!=objs[1].value)
	}
	__mod__(span, objs) {
		let text = objs[0].value
		let args = objs[1]
		if (_type_name(args)=='tuple')
			args = args.value
		else
			args = [args]
		let symbols = []
		for (let i = 0; i < text.length; ++ i) {
			if (text[i]=='%') {
				if (i == text.length-1) {
					__raise_exception(span, __new_obj('ValueError', 'incomplete format'))
					return
				}
				if (text[i+1]=='%') {
					++ i
					continue
				}
				else if (text[i+1]=='d')
					symbols.push([i,'int'])
				else if (text[i+1]=='f')
					symbols.push([i,'float'])
				else if (text[i+1]=='s')
					symbols.push([i,'str'])
				else if (text[i+1]=='r')
					symbols.push([i,'raw'])
				else {
					__raise_exception(span, __new_obj('ValueError', 'incomplete format'))
					return
				}
			}
		}
		if (symbols.length > args.length) {
			__raise_exception(span, __new_obj('TypeError', 'not enough arguments for format string'))
			return
		}
		if (symbols.length < args.length) {
			__raise_exception(span, __new_obj('TypeError', 'not all arguments converted during string formatting'))
			return
		}
		for (let i=symbols.length-1; i>=0; --i) {
			let t = symbols[i][1]
			let repr = null
			if (t=='str') {
				repr = __repr(span, args[i]).value
			}
			else if (t=='raw') {
				if (_type_name(args[i])=='str') repr = JSON.stringify(args[i].value)
				else repr = __repr(span, args[i]).value
			}
			else if (t=='int'||t=='float') {
				if (_type_name(args[i])=='int') repr = ''+args[i].value
				else if (_type_name(args[i])=='float') {
					if (t=='int') repr = ''+Math.floor(args[i].value)
					else repr = ''+args[i].value
				}
				else {
					__raise_exception(span, __new_obj('TypeError', '%d format: a number is required, not '+_type_name(args[i])))
					return
				}
			}
			let s = symbols[i][0]
			text = text.slice(0,s)+repr+text.slice(s+2)
		}
		return __new_obj('str', text)
	}
	format(span, objs, kwargs) {
		let obj = objs[0]
		let args = objs.slice(1)
		let text = obj.value
		let splits = text.split('{}')
		if (__assert_num_args(span,'str.split()', objs, [splits.length])) return
		text = ''
		for (let i in splits) {
			text += splits[i]
			if (i < args.length) {
				text += __repr(span, args[i]).value
				if (runtime.cur_thread.exit_val != null) return
			}
		}
		for (let [k,v] of kwargs) {
			text = text.replace('{'+k+'}', __repr(span, v).value)
		}
		return __new_obj('str', text)
	}
	__getitem__(span, objs) {
		if (__assert_num_args(span,'str.__getitem__()', objs, [2])) return
		let obj = objs[0]
		let slice = objs[1]
		if (__assert_type(span, slice, ['int','slice'], 'str.__getitem__()')) return
		if (_type_name(slice)=='int') {
			let i = slice.value
			if (i < 0 && i + obj.value.length >= 0)
				i += obj.value.length
			if (i<0 || i>=obj.value.length) {
				__raise_exception(span, __new_obj('IndexError', 'string index out of range: '+i))
				return
			}
			return __new_obj('str', obj.value[i])
		}
		slice = __slice_data(obj.value.length,slice)
		let indexes = __slice_indexes(slice[0],slice[1],slice[2])
		let arr = []
		for (let i of indexes) {
			if (i<0 || i>=obj.value.length) continue
			arr.push(obj.value[i])
		}
		return __new_obj('str', arr.join(''))
	}
	startswith(span, objs, kwargs) {
		if (__assert_num_args(span,'str.startswith()', objs, [2])) return
		if (__assert_type(span, objs[1], 'str', 'str.startswith()')) return
		return __new_obj('bool', objs[0].value.startsWith(objs[1].value))
	}
	endswith(span, objs, kwargs) {
		if (__assert_num_args(span,'str.endswith()', objs, [2])) return
		if (__assert_type(span, objs[1], 'str', 'str.endswith()')) return
		return __new_obj('bool', objs[0].value.endsWith(objs[1].value))
	}
}
function text_constant_to_text(text) {
	let val = ''
	for (let i = 1; i < text.length-1; ++ i) {
		if (text[i] != '\\') val += text[i]
		else {
			++ i;
			switch (text[i]) {
				case '\\': val += '\\'; break
				case 'n': val += '\n'; break
				case 'r': val += '\r'; break
				case 't': val += '\t'; break
				case '"': val += '"'; break
				case "'": val += "'"; break
				case '\n': break
			}
		}
	}
	return val
}
function text_to_text_constant(t) {
	t2=''
	for (let c of t) {
		switch (c) {
			case '\t': t2+='\\t'; break
			case '\r': t2+='\\r'; break
			case '\t': t2+='\\t'; break
			case '\n': t2+='\\n'; break
			case '\\': t2+='\\\\'; break
			case '"': t2+='\"'; break
			default: t2+=c
		}
	}
	return '"'+t2+'"'
}
function format_text_to_call(span) {
	let text = span.text.slice(1)
	let d_len = 1
	let p=[]
	let d=[]
	let l=[]
	function format_text_split(x) {
		if (x.length>=6 && (x.slice(0,3)=='"""'||x.slice(0,3)=="'''")) {
			d_len = 3
			x = x.substring(3, x.length-3)
		}
		else
			x = text_constant_to_text(x)
		let y=x.split('{')
		p.push(y[0])
		y=y.slice(1)
		let c=p[0].length+d_len+2
		for (let i of y) {
			if (i.indexOf('}')==-1)
				throw new SyntaxError(span, "f-string: expecting '}'")
			let s = i.split('}')
			d.push(s[0])
			p.push(s.slice(1).join('}'))
			l.push(c)
			c+=i.length+1
		}
	}
	format_text_split(text)
	text = p.join('{}')
	function correct_info(s,l) {
		s.file_nm = span.file_nm
		s.line_no = span.line_no
		s.prev_end += span.char_start+l
		s.char_start += span.char_start+l
		s.char_end += span.char_start+l
		for (let c in s.children)
			correct_info(c,l)
	}
	for (let i in d) {
		if (d[i].trim().length==0)
			throw new SyntaxError(span, "f-string: empty expression not allowed")
		d[i] = parse_exp(d[i], 'exp', span)
		correct_info(d[i],l[i])
	}
	let arg_rule = 'arg+, <-'
	for (let i in d) {
		d[i] = _clone_span(d[i], 'arg', 'arg <- exp', d[i])
		arg_rule += ' arg'
	}
	arg_ = _clone_span(span, 'arg+', arg_rule, d)
	let text_ = text
	text = _clone_span(span, '$text', null, [])
	text.text = text_to_text_constant(text_)
	let id = _clone_span(span, "$id", null, [])
	id.text = 'format'
	let dot = _clone_span(span, "'.'", null, [])
	dot.text = '.'
	let factor_text = _clone_span(span, 'factor', 'factor <- $text', text)
	let attribute = _clone_span(span, 'attribute', "attribute <- factor '.' $id", [factor_text,dot,id])
	let factor_attribute = _clone_span(span, 'factor', "factor <- attribute", attribute)
	let lrb = _clone_span(span, "'('", null, [])
	lrb.text = '('
	let rrb = _clone_span(span, "')'", null, [])
	rrb.text = ')'
	let fun_call = _clone_span(span, 'fun_call', "fun_call <- factor '(' arg+, ')'", [factor_attribute,lrb,arg_,rrb])
	return fun_call
}
function __repr(span, obj) {
	return runtime.cur_thread.run_method(span, _type(obj), '__repr__', [obj])
}
function __raise_exception(span, ex) {
	if (runtime.cur_thread.exit_val!=null && runtime.cur_thread.exit_val.type=='exception')
		ex.prev_exit_val = runtime.cur_thread.exit_val.value
	ex.stack = runtime.cur_thread.call_stack.slice(0)
	ex.span = span
	runtime.cur_thread.exit_val = {'type':'exception','value':ex}
}
function __assert_function_arg_type(span, obj, type, msg) {
	if (type.constructor.name == 'String')
		type = [type]
	let type_name = _type_name(obj)
	if (type.indexOf(type_name) == -1)
		__raise_exception(span, __new_obj('TypeError', msg))
}
function __is_num(obj) {
	let type_name = _type_name(obj)
	return (type_name == 'int' || type_name == 'float')
}
function __assert_num(span, obj) {
	if (! __is_num(obj)) {
		let type_name = _type_name(obj)
		__raise_exception(span, __new_obj('TypeError', "cannot apply a mathematic function on a '"+type_name+"'"))
		return true
	}
	return false
}
function __assert_bool(span, obj) {
	let type_name = _type_name(obj)
	if (type_name!='bool') {
		__raise_exception(span, __new_obj('TypeError', "cannot apply a boolean function on a '"+type_name+"'"))
		return true
	}
	return false
}
function __assert_num_args(span, func_name, objs, nums) {
	if (nums.indexOf(objs.length) == -1) {
		__raise_exception(span, __new_obj('TypeError', func_name+" takes "+nums.join(' or ')+" positional arguments but "+objs.length+" were given"))
		return true
	}
	return false
}
function __assert_type(span, obj, type, op) {
	if (type.constructor.name == 'String')
		type = [type]
	let type_name = _type_name(obj)
	if (type.indexOf(type_name) == -1) {
		__raise_exception(span, __new_obj('TypeError', 'cannot apply function '+op+' on an object of type '+type_name))
		return true
	}
	return false
}
function __assert_ret_type(span, res, type, op) {
	if (type.constructor.name == 'String')
		type = [type]
	let type_name = _type_name(res)
	if (type.indexOf(type_name) == -1) {
		__raise_exception(span, __new_obj('TypeError', "'"+type+"' is expected from method '"+op+"'"))
		return true
	}
	return false
}
function __builtin_print(span, args, kwargs) {
	function before(interrupt) {
		let line = ''
		for (let x of args) {
			if (line != '') line += ' '
			if (_type_name(x) != 'str')
				x = __repr(span, x)
			if (x===null) return
			line += x.value;
		}
		runtime.stdout(line)
		if (! kwargs.has('end'))
			runtime.stdout('\n')
		else
			runtime.stdout(__repr(span, kwargs.get('end')).value)
	}
	before(null)
}
function __builtin_input(span, args, kwargs) {
	if (runtime.stdin===null)
		return __builtin_input_1(span, args, kwargs)
	else {
		let line = runtime.stdin()
		if (line===null)
			__raise_exception(span, __new_obj('EOFError', 'No input'))
		else
			return __new_obj('str', line)
	}
}
function __builtin_input_1(span, args, kwargs) {
	function before(interrupt) {
		__assert_num_args(span,'input()', args, [0,1])
		if (args.length == 1)
			__assert_type(span, args[0], ['str'], 'input')
	}
	function action(interrupt) {
		setTimeout(()=>{
			let msg = 'Your Python program ('+span.file_nm+', line:'+(span.line_no+1)+')'+' is calling "input()"'
			if (args.length == 1)
				msg = msg+'\n'+args[0].value
			let res = prompt(msg, '')
			if (res === undefined || res == null)
				interrupt.runtime._interrupt_done(interrupt, __new_obj('EOFError', 'No input'))
			else
				interrupt.runtime._interrupt_done(interrupt, __new_obj('str', res))
		}, 100)
	}
	function after(resume_val) {
		if (_type_name(resume_val) == 'EOFError') {
			__raise_exception(span, resume_val)
		}
		else
			return resume_val
	}
	return runtime.__interrupt(span, before, after, action, -1)
}
let __file_cache = new Map()
function __rt_save_file(span, args) {
	__file_cache.set(args[0].value,args[1].value)
}
function __builtin_open(span, args, kwargs) {
	__assert_num_args(span,'open', args, [1,2])
	if (runtime.cur_thread.exit_val != null) return
	__assert_function_arg_type(span, args[0], 'str', 'open(): file name must be string')
	let mode = __new_obj('str','r')
	if (args.length == 2) {
		__assert_function_arg_type(span, args[1], 'str', 'open(): mode must be string')
		mode = args[1]
	}
	if (runtime.cur_thread.exit_val != null) return
	runtime.__import_module_interrupt(span, '_io')
	if (runtime.cur_thread.exit_val != null) return
	let file = args[0].value
	function _create_TextIOWrapper(text) {
		let _io = runtime.loaded_modules.get('_io')
		let type = _io.module_scope.vars.get('TextIOWrapper')
		let obj = __new_obj(type)
		text = text===__none?__none:__new_obj('str',text)
		runtime.cur_thread.run_method(span,type,'__init__',[obj,args[0],mode,text])
		return obj
	}
	if (__file_cache.has(file)) {
		return _create_TextIOWrapper(__file_cache.get(file))
	}
	function action(interrupt) {
		function report_error(msg) {
			interrupt.runtime._interrupt_done(interrupt, __new_obj('RuntimeError', msg))
		}
		let file_base = runtime.file_base
		let path = file
		if (path.indexOf('/') != -1)
			file_base = ''
		function fetch_succ(text) {
			interrupt.runtime._interrupt_done(interrupt, text)
		}
		function fetch_404(text) {
			interrupt.runtime._interrupt_done(interrupt, __none)
		}
		__fetch_text(file_base,path,fetch_succ,fetch_404,report_error,report_error,report_error)
	}
	function after(resume_val) {
		if (resume_val==__none || resume_val.constructor.name=='String') {
			__file_cache.set(file,resume_val)
			return _create_TextIOWrapper(resume_val)
		}
		__raise_exception(span, resume_val)
	}
	return runtime.__interrupt(span, null, after, action, -1)
}
function __rt_listdir(span, args) {
	let path = args[0].value
	function action(interrupt) {
		function report_error(msg) {
			interrupt.runtime._interrupt_done(interrupt, __new_obj('FileNotFoundError', msg))
		}
		fetch('/__dir__/'+(path=='.'?Runtime.file_base:path))
			.then(res => {
				if (res.status != 200) {
					report_error(res.statusText)
				}
				res.text().then(text=>{
					interrupt.runtime._interrupt_done(interrupt, text)
				})
				.catch(error => {
					report_error(error.message)
				})
			})
			.catch(error => {
				report_error(error.message)
			})
	}
	function after(resume_val) {
		if (resume_val.constructor.name == 'String') {
			let files = resume_val.split('\n')
			if (path=='.')
				for (let f of __file_cache.keys())
					if (files.indexOf(f) == -1)
						files.push(f)
			for (let i in files)
				files[i] = __new_obj('str', files[i])
			files = __new_obj('list', files)
			return files
		}
		__raise_exception(span, resume_val)
	}
	return runtime.__interrupt(span, null, after, action, -1)
}
function __builtin_id(span, args, kwargs) {
	if (__assert_num_args(span,'id', args, [1])) return
	return __new_obj('int', args[0].id)
}
function __builtin_hash(span, args, kwargs) {
	if (__assert_num_args(span,'hash', args, [1])) return
	return runtime.cur_thread.run_method(span, _type(args[0]), '__hash__', args)
}
function __builtin_iter(span, args, kwargs) {
	if (__assert_num_args(span,'iter', args, [1])) return
	if (args[0] == __none)
		return __none
	return runtime.cur_thread.run_method(span, _type(args[0]), '__iter__', args)
}
function __builtin_next(span, args, kwargs) {
	if (__assert_num_args(span,'next', args, [1])) return
	if (args[0] == __none)
		__raise_exception(span, __new_obj('StopIteration', ''))
	else
		return runtime.cur_thread.run_method(span, _type(args[0]), '__next__', args)
}
function __builtin_getattr(span, args, kwargs) {
	if (__assert_num_args(span,'getattr', args, [2])) return
	if (__assert_function_arg_type(span, args[1], 'str', 'getattr(): attribute name must be string')) return
	return runtime.cur_thread.getattr(span, args[0], args[1].value)
}
function __builtin_setattr(span, args, kwargs) {
	if (__assert_num_args(span,'setattr', args, [3])) return
	if (__assert_function_arg_type(span, args[1], 'str', 'setattr(): attribute name must be string')) return
	runtime.cur_thread.setattr(span, args[0], args[1].value, args[2])
}
function __builtin_hasattr(span, args, kwargs) {
	if (__assert_num_args(span,'hasattr', args, [2])) return
	if (__assert_function_arg_type(span, args[1], 'str', 'hasattr(): attribute name must be string')) return
	let res = runtime.cur_thread.hasattr(span, args[0], args[1].value)
	if (runtime.cur_thread.exit_val != null) return
	return __new_obj('bool', res)
}
function __builtin_callable(span, args, kwargs) {
	if (__assert_num_args(span,'callable', args, [1])) return
	return  __new_obj('bool', __callable(span, args[0]))
}
function __callable(span, obj) {
	let type_name = _type_name(obj)
	if (type_name=='function'||type_name=='method'||type_name=='builtin_function_or_method')
		return true
	let attr = runtime.cur_thread.__get_class_attr(span, obj, _type(obj), '__call__')
	if (attr != null) {
		type_name = _type_name(attr)
		if (type_name == 'function' || type_name == 'builtin_function_or_method')
			return true
	}
	return false
}
function __builtin_issubclass(span, args, kwargs) {
	if (__assert_num_args(span,'issubclass', args, [2])) return
	if (__assert_type(span, args[0], ['type'], 'instanceof')) return
	if (__assert_type(span, args[1], ['type','list','tuple'], 'instanceof')) return
	let types = null
	if (_type_name(args[1]) == 'type')
		types = [args[1]]
	else
		types = args[1].value
	for (let type_obj of types)
		if (runtime.cur_thread.__issubclass(span, args[0], type_obj))
			return __new_obj('bool', true)
	return __new_obj('bool', false)
}
function __builtin_isinstance(span, args, kwargs) {
	if (__assert_num_args(span,'isinstance', args, [2])) return
	args[0] = _type(args[0])
	return __builtin_issubclass(span, args, kwargs)
}
function __builtin_len(span, args, kwargs) {
	if (__assert_num_args(span,'len', args, [1])) return
	return runtime.cur_thread.run_method(span, _type(args[0]), '__len__', args)
}
class _Range
{
	__init__(span, args, kwargs) {
		if (__assert_num_args(span,'range', args, [2,3,4])) return
		let obj = args[0]
		args = args.slice(1)
		let a = []
		for (let arg of args) {
			if (__assert_type(span, arg, 'int', 'range')) return
			a.push(arg.value)
		}
		if (a.length == 1) a = [0, a[0]]
		if (a.length == 2) {
			if (a[0] < a[1]) a = [a[0], a[1], 1]
			else a = [a[0], a[1], -1]
		}
		if (a[2]==0) {
			__raise_exception(span, __new_obj('ValueError', 'range() arg 3 must not be zero'))
			return
		}
		obj.value = a
	}
	__iter__(span, args) {
		return args[0]
	}
	__next__(span, args) {
		let a = args[0].value
		if ((a[2]>0 && a[0]>=a[1]) || (a[2]<0 && a[0]<=a[1])) {
			__raise_exception(span, __new_obj('StopIteration', ''))
			return
		}
		let n = a[0]
		a[0] += a[2]
		return __new_obj('int', n)
	}
}
function __builtin_round(span, args, kwargs) {
	if (__assert_num_args(span,'round', args, [1])) return
	if (__assert_num(span, args[0])) return
	return __new_obj('int', Math.round(args[0].value))
}
function __rt_time(span, args, kwargs) {
	return __new_obj('float', new Date().getTime() / 1000)
}
function __rt_get_ident(span, args, kwargs) {
	return __new_obj('int', runtime.cur_thread.thread_id)
}
function __rt_start_new_thread(span, args, kwargs) {
	if (__assert_num_args(span,'__rt_start_new_thread', args, [2])) return
	let func = args[0]
	let argv = args[1].value
	let call = __action_fun_call__handle_args_2(span, func, argv, kwargs)
	if (runtime.cur_thread.exit_val != null) return
	return runtime.__new_function_thread(span, call[0], call[1])
}
function __rt_acquire_lock(span, args, kwargs) {
	let thread_id = runtime.cur_thread.thread_id
	let lock = args[0]
	let timeout = args[1].value
	function before(interrupt) {
		if (! ('waiting_set' in lock)) {
			lock.waiting_set = new Set()
			lock.waiting_list = []
		}
		if (! lock.waiting_set.has(thread_id)) {
			lock.waiting_set.add(thread_id)
			lock.waiting_list.push(interrupt)
		}
	}
	function after(res) {
		if (res == false)
			lock.waiting_set.delete(thread_id)
		return __new_obj('bool', res)
	}
	return runtime.__interrupt(span, before, after, null, timeout)
}
function __rt_release_lock(span, args, kwargs) {
	let lock = args[0]
	if (! ('waiting_set' in lock))
		return
	while (lock.waiting_list.length > 0) {
		let interrupt = lock.waiting_list.shift()
		if (lock.waiting_set.has(interrupt.thread_id)) {
			lock.waiting_set.delete(interrupt.thread_id)
			interrupt.runtime._interrupt_done(interrupt, true)
			break
		}
	}
}
function __builtin_sorted(span, args, kwargs) {
	if (__assert_num_args(span,'sorted()', args, [1])) return
	let it = args[0]
	let l = __new_obj('list',[])
	__values_from_iter(span, 'sorted()', [l,it])
	let d = l.value
	if (d.length == 0) return l
	let elt_type = _type(d[0])
	function lt(o1,o2) {
		return runtime.cur_thread.run_method(span, elt_type, '__lt__', [o1,o2])
	}
	for (let i = d.length-1; i > 0; -- i)
		for (let j = 0; j < i; ++ j) {
			let c = lt(d[j+1],d[j])
			if (runtime.cur_thread.exit_val != null) return
			if (c.value) {
				let tmp = d[j]
				d[j] = d[j+1]
				d[j+1] = tmp
			}
		}
	return l
}
function __builtin_dir(span, args, kwargs) {
	if (__assert_num_args(span,'dir()', args, [1])) return
	let obj = args[0]
	let d = []
	let keys = null
	if (_type_name(obj) == 'module')
		keys = obj.module_scope.vars.keys()
	else
		keys = obj.attr.keys()
	for (let a of keys)
		d.push(__new_obj('str',a))
	return __new_obj('list', d)
}
function __builtin_vars(span, args, kwargs) {
	if (__assert_num_args(span,'vars()', args, [1])) return
	let obj = args[0]
	let vars = null
	if (_type_name(obj) == 'module')
		vars = obj.module_scope.vars
	else
		vars = obj.attr
	let d = __new_obj('dict', new Map())
	let _dict = new _Dict()
	for (let [k,v] of vars)
		_dict.__setitem__(null, [d, __new_obj('str',k), v])
	return d
}
function __rt_argv(span, args, kwargs) {
	let l = document.location
	let origin = l.origin
	let href = l.href.substring(origin.length)
	return __new_obj('list', [__new_obj('str', origin), __new_obj('str', href)])
}
function __rt_format_exc(span, args, kwargs) {
	return __new_obj('str', runtime.format_exc())
}
function __rt_exc_info(span, args, kwargs) {
	let ex = runtime.__cur_ex()
	let ex_type = null
	if (ex!==null)
		ex_type = _type(ex)
	return __new_obj('tuple', [ex_type, ex, __none])
}
function __app123_event(span, args, kwargs) {
	function before(interrupt) {
		if (__assert_num_args(span,'app123_event()', args, [1])) return
		__assert_type(span, args[0], ['str'], 'app123_event()')
	}
	function action(interrupt) {
		let _action = args[0].value
		if (kwargs.constructor===Map) {
			let m = kwargs
			kwargs = {}
			for (let [k,v] of m) {
				if (v.constructor===__rt_object) {
					v = __py2js(span, v)
				}
				kwargs[k] = v
			}
		}
		data_hub.onevent(_action, '', kwargs, _data=>{
			if (_data===null) _data=__none
			interrupt.runtime._interrupt_done(interrupt, _data) 
		})
	}
	function after(_data) {
		if (_data!==__none)
			_data = __js2py(_data, true)
		return _data
	}
	return runtime.__interrupt(span, before, after, action, -1)
}
function __list_index(span, list, obj) {
	for (let i = 0; i < list.length; ++ i) {
		let o = list[i]
		if (o.id==obj.id) return i
		let b = runtime.cur_thread.run_method(span, _type(obj), '__eq__', [obj, o])
		if (_type_name(b) != 'bool') {
			__raise_exception(span, __new_obj('TypeError', "method __eq__ in type '"+_type_name(obj)+"' does not return a bool"))
		}
		if (b.value) return i
	}
	return -1
}
function __list_contains(span, list, obj) {
	let i = __list_index(span, list, obj)
	return __new_obj('bool', i != -1)
}
function __list_from_iter(span, iter) {
	let value = []
	iter = runtime.cur_thread.run_method(span, _type(iter), '__iter__', [iter])
	if (runtime.cur_thread.exit_val != null) return
	if (iter==null) {
		console.log('---->HERE')
	}
	while (true) {
		let next = runtime.cur_thread.run_method(span, _type(iter), '__next__', [iter])
		if (runtime.cur_thread.exit_val != null) {
			if (runtime.cur_thread.exit_val.type=='exception' && _type_name(runtime.cur_thread.exit_val.value)=='StopIteration')
				runtime.cur_thread.exit_val = null
			break
		}
		value.push(next)
	}
	return value
}
function __values_from_iter(span, func_name, objs) {
	if (__assert_num_args(span, func_name, objs, [1,2])) return
	let obj = objs[0]
	obj.value = []
	if (objs.length == 2) {
		obj.value = __list_from_iter(span, objs[1])
	}
}
class _Iterator
{
	__iter__(span, objs) {
		return objs[0]
	}
	__next__(span, objs) {
		let d = objs[0].value
		if (d[0] >= d[2].length || d[0] >= d[1])
			__raise_exception(span, __new_obj('StopIteration', ""))
		d[0] += 1
		return d[2][d[0]-1]
	}
}
function __check_bound(span, objs, op) {
	if (__assert_type(span, objs[1], 'int', op)) return
	let index = objs[1].value
	if (index < 0) index += objs[0].value.length
	if (index < 0 || index >= objs[0].value.length)
		__raise_exception(span, __new_obj('IndexError', "list index out of range"))
	return index
}
function __obj_repr(span, o) {
	if (_type_name(o) == 'str')
		return '"'+o.value.replace('\\','\\\\').replace('\r','\\r').replace('\n','\\n').replace('\t','\\t').replace('"','\\"')+'"'
	else
		return __repr(span, o).value
}
function __list_items(span,typename,obj,slice) {
	if (_type_name(slice)=='int') {
		let i = slice.value
		if (i < 0 && i + obj.value.length >= 0)
			i += obj.value.length
		if (i<0 || i>=obj.value.length) {
			__raise_exception(span, __new_obj('IndexError', 'list index out of range: '+i))
			return
		}
		return obj.value[i]
	}
	slice = __slice_data(obj.value.length,slice)
	let indexes = __slice_indexes(slice[0],slice[1],slice[2])
	let arr = []
	for (let i of indexes) {
		if (i<0 || i>=obj.value.length) continue
		arr.push(obj.value[i])
	}
	return __new_obj(typename,arr)
}
function __list_cmp(span,value1,value2) {
	let len = Math.min(value1.length, value2.length)
	for (let i = 0; i < len; ++ i) {
		let obj1 = value1[i]
		let obj2 = value2[i]
		let eq = runtime.cur_thread.run_method(span, _type(obj1), '__eq__', [obj1,obj2])
		if (runtime.cur_thread.exit_val !== null) return
		if (eq.value) continue
		let lt = runtime.cur_thread.run_method(span, _type(obj1), '__lt__', [obj1,obj2])
		if (runtime.cur_thread.exit_val !== null) return
		if (lt.value) return -1
		else return 1
	}
	if (value1.length < value2.length) return -1
	if (value1.length > value2.length) return 1
	return 0
}
class _List
{
	__init__(span, objs, kwargs) {
		__values_from_iter(span, 'list.__init__()', objs)
	}
	clear(span, objs) {
		if (__assert_num_args(span, 'list.clear()', objs, [1])) return
		objs[0].value = []
	}
	__len__(span, objs) {
		if (__assert_num_args(span, 'list.__len__()', objs, [1])) return
		return __new_obj('int', objs[0].value.length)
	}
	__add__(span, objs) {
		if (__assert_num_args(span, 'list.__add__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'list', '+')) return
		return __new_obj('list', objs[0].value.concat(objs[1].value))
	}
	__contains__(span, objs) {
		if (__assert_num_args(span, 'list.__contains__()', objs, [2])) return
		return __list_contains(span.children[0], objs[0].value, objs[1])
	}
	__repr__(span, objs) {
		if (__assert_num_args(span, 'list.__repr__()', objs, [1])) return
		let repr = ''
		for (let o of objs[0].value) {
			if (repr.length > 0) repr += ', '
			repr += __obj_repr(span, o)
		}
		return __new_obj('str', '['+repr+']')
	}
	__iter__(span, objs) {
		if (__assert_num_args(span, 'list.__iter__()', objs, [1])) return
		return __new_obj('_iterator', [0,objs[0].value.length,objs[0].value])
	}
	__getitem__(span, objs) {
		if (__assert_num_args(span, 'list.__getitem__()', objs, [2])) return
		let obj = objs[0]
		let slice = objs[1]
		if (__assert_type(span, slice, ['int','slice'], 'list.__getitem__()')) return
		return __list_items(span,'list',obj,slice)
	}
	__delitem__(span, objs) {
		if (__assert_num_args(span, 'list.__getitem__()', objs, [2])) return
		let obj = objs[0]
		let slice = objs[1]
		if (__assert_type(span, slice, ['int','slice'], 'list.__delitem__()')) return
		if (_type_name(slice) == 'int') {
			let i = slice.value
			if (i < 0 && i + obj.value.length >= 0)
				i += obj.value.length
			if (i<0 || i>=obj.value.length) {
				__raise_exception(span, __new_obj('IndexError', 'list index out of range: '+i))
				return
			}
			obj.value.splice(i,1)
			return __none
		}
		slice = __slice_data(obj.value.length,slice)
		let indexes = __slice_indexes(slice[0],slice[1],slice[2])
		let arr = []
		for (let i in obj.value) {
			i = Math.floor(i)
			if (indexes.indexOf(i)==-1)
				arr.push(obj.value[i])
		}
		obj.value = arr
		return __none
	}
	pop(span, objs, kwargs) {
		if (__assert_num_args(span, 'list.pop()', objs, [1,2])) return
		if (objs.length > 1)
			if (__assert_type(span, objs[1], 'int', 'list.pop()')) return
		let index = objs[0].value.length - 1
		if (index < 0) {
			__raise_exception(span, __new_obj('IndexError', ""))
			return
		}
		if (objs.length > 1) {
			index = __check_bound(span, objs, 'list.pop()')
			if (runtime.cur_thread.exit_val != null) return
		}
		let ret = objs[0].value[index]
		objs[0].value.splice(index, 1)
		return ret
	}
	__setitem__(span, objs) {
		if (__assert_num_args(span, 'list.__setitem__()', objs, [3])) return
		let obj = objs[0]
		let slice = objs[1]
		if (__assert_type(span, slice, ['int','slice'], 'str.__getitem__()')) return
		if (_type_name(slice)=='int') {
			let i = slice.value
			if (i < 0 && i + obj.value.length >= 0)
				i += obj.value.length
			if (i<0 || i>=obj.value.length) {
				__raise_exception(span, __new_obj('IndexError', 'list index out of range: '+i))
				return
			}
			obj.value[i] = objs[2]
			return __none
		}
		let data = __new_obj('list', [])
		__values_from_iter(span, 'list.__setitem__()', [data, objs[2]])
		slice = __slice_data(obj.value.length,slice)
		if (slice[2]==1 || slice[2]==-1) {
			if (slice[2]==-1) {
				slice = [slice[1]+1,slice[0]+1,1]
				data.value = data.value.revrese()
			}
			for (let i of [slice[0],slice[1]-1])
				if (i<0 || i>=obj.value.length) {
					__raise_exception(span, __new_obj('IndexError', 'list index out of range: '+i))
					return
				}
			obj.value.splice(slice[0],slice[1]-slice[0],...data.value)
		}
		else {
			let indexes = __slice_indexes(slice[0],slice[1],slice[2])
			if (indexes.length != data.value.length) {
				__raise_exception(span, __new_obj('ValueError','attempt to assign sequence of size '+data.value.length+' to extended slice of size '+indexes.length))
				return
			}
			for (let k in indexes) {
				let i = indexes[k]
				if (i<0 || i>=obj.value.length) {
					__raise_exception(span, __new_obj('IndexError', 'list index out of range: '+i))
					return
				}
				obj.value[i] = data.value[k]
			}
		}
		return __none
	}
	append(span, objs) {
		if (__assert_num_args(span, 'list.append()', objs, [2])) return
		objs[0].value.push(objs[1])
	}
	insert(span, objs) {
		if (__assert_num_args(span, 'list.insert()', objs, [3])) return
		let index = __check_bound(span, objs, 'insert')
		objs[0].value.splice(index, 0, objs[2])
	}
	extend(span, objs) {
		if (__assert_num_args(span, 'list.extend()', objs, [2])) return
		let list2 = __new_obj('list', [])
		__values_from_iter(span, 'list.extend()', [list2, objs[1]])
		objs[0].value = objs[0].value.concat(list2.value)
	}
	index(span, objs) {
		if (__assert_num_args(span, 'list.index()', objs, [2])) return
		let index = __list_index(span.children[0], objs[0].value, objs[1])
		if (index==-1)
			__raise_exception(span, __new_obj('ValueError', __repr(objs[1])+' is not in list'))
		else
			return __new_obj('int', index)
	}
	remove(span, objs) {
		if (__assert_num_args(span, 'list.remove()', objs, [2])) return
		let index = __list_index(span.children[0], objs[0].value, objs[1])
		if (index==-1)
			__raise_exception(span, __new_obj('ValueError', __repr(objs[1])+' is not in list'))
		else
			objs[0].value.splice(index, 1)
	}
	__eq__(span, objs) {
		if (__assert_num_args(span, 'list.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__eq__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__eq__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==0)
	}
	__ne__(span, objs) {
		if (__assert_num_args(span, 'list.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__eq__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__eq__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=0)
	}
	__lt__(span, objs) {
		if (__assert_num_args(span, 'list.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__lt__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==-1)
	}
	__gt__(span, objs) {
		if (__assert_num_args(span, 'list.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__lt__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==1)
	}
	__le__(span, objs) {
		if (__assert_num_args(span, 'list.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__lt__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=1)
	}
	__ge__(span, objs) {
		if (__assert_num_args(span, 'list.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'list', 'list.__lt__()')) return
		if (__assert_type(span, objs[1], 'list', 'list.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=-1)
	}
	sort(span, objs, kwargs) {
		if (__assert_num_args(span, 'list.sort()', objs, [1])) return
		let arr = objs[0].value
		for (let i = arr.length-1; i>0; -- i) {
			for (let j = 0; j<i; ++ j) {
				let o1 = arr[j]
				let o2 = arr[j+1]
				let lt = runtime.cur_thread.run_method(span, _type(o1), '__lt__', [o1,o2])
				if (lt.value===false) {
					arr[j] = o2
					arr[j+1] = o1
				}
			}
		}
	}
}
class _Tuple
{
	__init__(span, objs, kwargs) {
		__values_from_iter(span, 'tuple.__init__()', objs)
	}
	__len__(span, objs) {
		if (__assert_num_args(span, 'tuple.__len__()', objs, [1])) return
		return __new_obj('int', objs[0].value.length)
	}
	__add__(span, objs) {
		if (__assert_num_args(span, 'tuple.__add__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'tuple', '+')) return
		return __new_obj('tuple', objs[0].value.concat(objs[1].value))
	}
	__contains__(span, objs) {
		if (__assert_num_args(span, 'tuple.__contains__()', objs, [2])) return
		return __list_contains(span.children[0], objs[0].value, objs[1])
	}
	__repr__(span, objs) {
		if (__assert_num_args(span, 'tuple.__repr__()', objs, [1])) return
		let repr = ''
		for (let o of objs[0].value) {
			if (repr.length > 0) repr += ', '
			repr += __obj_repr(span, o)
		}
		return __new_obj('str', '('+repr+')')
	}
	__iter__(span, objs) {
		if (__assert_num_args(span, 'tuple.__iter__()', objs, [1])) return
		return __new_obj('_iterator', [0,objs[0].value.length,objs[0].value])
	}
	__getitem__(span, objs) {
		if (__assert_num_args(span, 'tuple.__getitem__()', objs, [2])) return
		let obj = objs[0]
		let slice = objs[1]
		if (__assert_type(span, slice, ['int','slice'], 'tuple.__getitem__()')) return
		return __list_items(span,'tuple',obj,slice)
	}
	index(span, objs) {
		if (__assert_num_args(span, 'tuple.index()', objs, [2])) return
		let index = __list_index(span.children[0], objs[0].value, objs[1])
		if (index==-1)
			__raise_exception(span, __new_obj('ValueError', __repr(objs[1])+' is not in tuple'))
		else
			return __new_obj('int', index)
	}
	__eq__(span, objs) {
		if (__assert_num_args(span, 'tuple.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__eq__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__eq__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==0)
	}
	__ne__(span, objs) {
		if (__assert_num_args(span, 'tuple.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__ne__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__ne__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=0)
	}
	__lt__(span, objs) {
		if (__assert_num_args(span, 'tuple.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__lt__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==-1)
	}
	__gt__(span, objs) {
		if (__assert_num_args(span, 'tuple.__gt__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__lt__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp==1)
	}
	__le__(span, objs) {
		if (__assert_num_args(span, 'tuple.__le__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__lt__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=1)
	}
	__ge__(span, objs) {
		if (__assert_num_args(span, 'tuple.__ge__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__lt__()')) return
		if (__assert_type(span, objs[1], 'tuple', 'tuple.__lt__()')) return
		let cmp = __list_cmp(span, objs[0].value, objs[1].value)
		return __new_obj('bool', cmp!=-1)
	}
	__hash__(span, objs) {
		if (__assert_num_args(span, 'tuple.__hash__()', objs, [1])) return
		if (__assert_type(span, objs[0], 'tuple', 'tuple.__hash__()')) return
		let hash = 0
		for (let e of objs[0].value) {
			let h = runtime.cur_thread.run_method(span, _type(e), '__hash__', [e])
			if (runtime.cur_thread.exit_val !== null) return
			hash = (hash << 5) ^ h.value
		}
		return __new_obj('int', hash)
	}
}
function __hash(span, key) {
	return runtime.cur_thread.run_method(span, _type(key), '__hash__', [key])
}
function __set_index(s,e) {
	for (let i in s) {
		let eq = runtime.cur_thread.run_method(span, _type(e), '__eq__', [e,s[i]])
		if (runtime.cur_thread.exit_val !== null) return
		if (eq.value) return i
	}
	return -1
}
function __dict_eq(span, value1, value2) {
	let h1 = Array.from(value1.keys())
	let h2 = Array.from(value2.keys())
	if (h1.length!=h2.length) return false
	h1.sort()
	h2.sort()
	for (let i in h1)
		if (h1[i]!=h2[i]) return false
	function cmp(k1,v1,k2,v2) {
		for (let i in k1) {
			let k = k1[i]
			let j = __set_index(k2,k)
			if (runtime.cur_thread.exit_val !== null) return
			if (j==-1) return false
			let eq = runtime.cur_thread.run_method(span, _type(v1[i]), '__eq__', [v1[i],v2[j]])
			if (runtime.cur_thread.exit_val !== null) return
			if (!eq.value) return false
		}
		return true
	}
	for (let h of h1) {
		let b1 = value1.get(h)
		let b2 = value2.get(h)
		let k1 = b1[0]
		let v1 = b1[1]
		let k2 = b2[0]
		let v2 = b2[1]
		if (k1.length!=k2.length) return false
		if (! cmp(k1,v1,k2,v2)) return false
	}
	return true
}
class _Dict
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span, 'dict.__init__()', objs, [1])) return
		objs[0].value = new Map()
		let cls = new _Dict()
		let obj = objs[0]
		for (let [k,o] of kwargs)
			cls.__setitem__(span, [obj, __new_obj('str',k), o])
	}
	clear(span, objs) {
		if (__assert_num_args(span, 'dict.clear()', objs, [1])) return
		objs[0].value = new Map()
	}
	update(span, objs) {
		if (__assert_num_args(span, 'dict.update()', objs, [2])) return
		if (__assert_type(span, objs[1], 'dict', 'update')) return
		let map1 = objs[0].value
		let map2 = objs[1].value
		for (let [h,l] of map2) {
			if (! map1.has(h))
				map1.set(h, [[],[]])
			let list1 = map1.get(h)
			let list2 = map2.get(h)
			for (let j in list2[0]) {
				let k2=list2[0][j]
				let v2=list2[1][j]
				let i = __list_index(span, list1[0], k2)
				if (i==-1) {
					list1[0].push(k2)
					list1[1].push(v2)
				}
				else {
					list1[1][i] = v2
				}
			}
		}
	}
	__contains__(span, objs) {
		if (__assert_num_args(span, 'dict.__contains__()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span.children[0], key).value
		if (! map.has(h))
			return __new_obj('bool', false)
		let list = map.get(h)
		return __list_contains(span.children[0], list[0], key)
	}
	__repr__(span, objs) {
		if (__assert_num_args(span, 'dict.__repr__()', objs, [1])) return
		let repr = ''
		for (let [h,list] of objs[0].value) {
			for (let i = 0; i < list[0].length; ++ i) {
				let k = list[0][i]
				let v = list[1][i]
				if (repr.length > 0) repr += ', '
				repr += __obj_repr(span, k)
				repr += ': '
				repr += __obj_repr(span, v)
			}
		}
		return __new_obj('str', '{'+repr+'}')
	}
	keys(span, objs) {
		if (__assert_num_args(span, 'dict.keys()', objs, [1])) return
		let list = __new_obj('list', [])
		for (let [h,ll] of objs[0].value) {
			for (let i = 0; i < ll[0].length; ++ i) {
				let k = ll[0][i]
				list.value.push(k)
			}
		}
		return list
	}
	__len__(span, objs) {
		if (__assert_num_args(span, 'dict.__len__()', objs, [1])) return
		let len = 0
		for (let [h,ll] of objs[0].value)
			len += ll[0].length
		return __new_obj('int', len)
	}
	__iter__(span, objs) {
		if (__assert_num_args(span, 'dict.__iter__()', objs, [1])) return
		let keys = []
		for (let [h,ll] of objs[0].value) {
			for (let i = 0; i < ll[0].length; ++ i) {
				keys.push(ll[0][i])
			}
		}
		return __new_obj('_iterator', [0,keys.length,keys])
	}
	items(span, objs) {
		if (__assert_num_args(span, 'dict.items()', objs, [1])) return
		let list = __new_obj('list', [])
		for (let [h,ll] of objs[0].value) {
			for (let i = 0; i < ll[0].length; ++ i) {
				let k = ll[0][i]
				let v = ll[1][i]
				list.value.push(__new_obj('tuple', [k, v]))
			}
		}
		return list
	}
	__getitem__(span, objs) {
		if (__assert_num_args(span, 'dict.__getitem__()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h)) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return null
		}
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list[0], key)
		if (i == -1) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return null
		}
		return list[1][i]
	}
	get(span, objs, kwargs) {
		if (__assert_num_args(span, 'set.__init__()', objs, [2,3])) return
		let map = objs[0].value
		let key = objs[1]
		let default_val = __none
		if (objs.length == 3)
			default_val = objs[2]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h)) return default_val
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list[0], key)
		if (i == -1) return default_val
		return list[1][i]
	}
	__setitem__(span, objs) {
		if (__assert_num_args(span, 'set.__setitem__()', objs, [3])) return
		let map = objs[0].value
		let key = objs[1]
		let val = objs[2]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h))
			map.set(h, [[],[]])
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list[0], key)
		if (i == -1) {
			list[0].push(key)
			list[1].push(val)
		}
		else
			list[1][i] = val
		return __none
	}
	pop(span, objs) {
		if (__assert_num_args(span, 'set.pop()', objs, [2,3])) return
		let map = objs[0].value
		let key = objs[1]
		let value = (objs.length>2 ? objs[2] : null)
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h)) {
			if (value!==null) return value
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list[0], key)
		if (i == -1) {
			if (value!==null) return value
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		value = list[1][i]
		list[0].splice(i,1)
		list[1].splice(i,1)
		if (list[0].length == 0) map.delete(h)
		return value
	}
	__delitem__(span, objs) {
		if (__assert_num_args(span, 'set.__delitem__()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h)) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list[0], key)
		if (i == -1) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		list[0].splice(i,1)
		list[1].splice(i,1)
		if (list[0].length == 0) map.delete(h)
		return __none
	}
	__eq__(span, objs) {
		if (__assert_num_args(span, 'dict.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'dict', 'dict.__eq__()')) return
		if (__assert_type(span, objs[1], 'dict', 'dict.__eq__()')) return
		let eq = __dict_eq(span, objs[0].value, objs[1].value)
		return __new_obj('bool', eq)
	}
	__ne__(span, objs) {
		if (__assert_num_args(span, 'dict.__ne__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'dict', 'dict.__ne__()')) return
		if (__assert_type(span, objs[1], 'dict', 'dict.__ne__()')) return
		let eq = __dict_eq(span, objs[0].value, objs[1].value)
		return __new_obj('bool', !eq)
	}
}
function __set_eq(span, value1, value2) {
	let h1 = Array.from(value1.keys())
	let h2 = Array.from(value2.keys())
	if (h1.length!=h2.length) return false
	h1.sort()
	h2.sort()
	for (let i in h1)
		if (h1[i]!=h2[i]) return false
	function cmp(k1,k2) {
		for (let i in k1) {
			let k = k1[i]
			let j = __set_index(k2,k)
			if (runtime.cur_thread.exit_val !== null) return
			if (j==-1) return false
		}
		return true
	}
	for (let h of h1) {
		let k1 = value1.get(h)
		let k2 = value2.get(h)
		if (k1.length!=k2.length) return false
		if (! cmp(k1,k2)) return false
	}
	return true
}
function __set_to_list(s) {
	let l = []
	for (let [h,ll] of s.value)
		for (let e of ll) l.push(e)
	return l
}
class _Set
{
	__init__(span, objs, kwargs) {
		if (__assert_num_args(span, 'set.__init__()', objs, [1, 2])) return
		objs[0].value = new Map()
		if (objs.length == 2) {
			let s = new _Set()
			let value = __list_from_iter(span, objs[1])
			for (let e of value)
				s.add(span, [objs[0], e])
		}
	}
	clear(span, objs) {
		if (__assert_num_args(span, 'set.clear()', objs, [1])) return
		objs[0].value = new Map()
		return __none
	}
	update(span, objs) {
		if (__assert_num_args(span, 'set.update()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'update')) return
		let map1 = objs[0].value
		let map2 = objs[1].value
		for (let [k,v] of map2) {
			if (! map1.has(k))
				map1.set(k, [])
			let list = map1.get(l)
			let i = __list_index(span, list, v)
			if (i==-1)
				list.push(v)
		}
		return __none
	}
	__contains__(span, objs) {
		if (__assert_num_args(span, 'set.__contains__()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span.children[0], key).value
		if (! map.has(h))
			return __new_obj('bool', false)
		let list = map.get(h)
		return __list_contains(span.children[0], list, key)
	}
	__repr__(span, objs) {
		if (__assert_num_args(span, 'set.__repr__()', objs, [1])) return
		if (objs[0].value.size==0)
			return __new_obj('str', 'set()')
		let repr = ''
		for (let [h,list] of objs[0].value) {
			for (let i = 0; i < list.length; ++ i) {
				let k = list[i]
				if (repr.length > 0) repr += ', '
				repr += __obj_repr(span, k)
			}
		}
		return __new_obj('str', '{'+repr+'}')
	}
	__len__(span, objs) {
		if (__assert_num_args(span, 'set.__len__()', objs, [1])) return
		let len = 0
		for (let [h,ll] of objs[0].value)
			len += ll.length
		return __new_obj('int', len)
	}
	__iter__(span, objs) {
		if (__assert_num_args(span, 'set.__iter__()', objs, [1])) return
		let l = __set_to_list(objs[0])
		return __new_obj('_iterator', [0,l.length,l])
	}
	add(span, objs) {
		if (__assert_num_args(span, 'set.add()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h))
			map.set(h, [])
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list, key)
		if (i == -1) {
			list.push(key)
		}
		return __none
	}
	remove(span, objs) {
		if (__assert_num_args(span, 'set.remove()', objs, [2])) return
		let map = objs[0].value
		let key = objs[1]
		let h = __hash(span===null?null:span.children[1], key).value
		if (! map.has(h)) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		let list = map.get(h)
		let i = __list_index(span===null?null:span.children[1], list, key)
		if (i == -1) {
			__raise_exception(span, __new_obj('KeyError', __repr(span, key).value))
			return
		}
		list.splice(i,1)
		if (list.length == 0) map.delete(h)
		return __none
	}
	__eq__(span, objs) {
		if (__assert_num_args(span, 'set.__eq__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'set', 'set.__eq__()')) return
		if (__assert_type(span, objs[1], 'set', 'set.__eq__()')) return
		let eq = __set_eq(span, objs[0].value, objs[1].value)
		return __new_obj('bool', eq)
	}
	__ne__(span, objs) {
		if (__assert_num_args(span, 'set.__ne__()', objs, [2])) return
		if (__assert_type(span, objs[0], 'set', 'set.__ne__()')) return
		if (__assert_type(span, objs[1], 'set', 'set.__ne__()')) return
		let eq = __set_eq(span, objs[0].value, objs[1].value)
		return __new_obj('bool', !eq)
	}
	__lt__(span, objs) {
		if (__assert_num_args(span, 'set.__lt__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__lt__()')) return
		let s = new _Set()
		if (s.__len__(span, [objs[0]]).value >= s.__len__(span, [objs[1]]).value)
			return __new_obj('bool', false)
		let l = __set_to_list(objs[0])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[1], e])
			if (! isin.value) return __new_obj('bool', false)
		}
		return __new_obj('bool', true)
	}
	__gt__(span, objs) {
		if (__assert_num_args(span, 'set.__gt__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__gt__()')) return
		let s = new _Set()
		if (s.__len__(span, [objs[0]]).value <= s.__len__(span, [objs[1]]).value)
			return __new_obj('bool', false)
		let l = __set_to_list(objs[1])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[0], e])
			if (! isin.value) return __new_obj('bool', false)
		}
		return __new_obj('bool', true)
	}
	__le__(span, objs) {
		if (__assert_num_args(span, 'set.__le__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__le__()')) return
		let s = new _Set()
		let l = __set_to_list(objs[0])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[1], e])
			if (! isin.value) return __new_obj('bool', false)
		}
		return __new_obj('bool', true)
	}
	__ge__(span, objs) {
		if (__assert_num_args(span, 'set.__ge__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__ge__()')) return
		let s = new _Set()
		let l = __set_to_list(objs[1])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[0], e])
			if (! isin.value) return __new_obj('bool', false)
		}
		return __new_obj('bool', true)
	}
	__and__(span, objs) {
		if (__assert_num_args(span, 'set.__and__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__and__()')) return
		let s = new _Set()
		let set3 = __new_obj('set', new Map())
		let l = __set_to_list(objs[1])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[0], e])
			if (isin.value)
				s.add(span, [set3, e])
		}
		return set3
	}
	__xor__(span, objs) {
		if (__assert_num_args(span, 'set.__xor__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__xor__()')) return
		let s = new _Set()
		let set3 = __new_obj('set', new Map())
		let l = __set_to_list(objs[0])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[1], e])
			if (! isin.value)
				s.add(span, [set3, e])
		}
		l = __set_to_list(objs[1])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[0], e])
			if (! isin.value)
				s.add(span, [set3, e])
		}
		return set3
	}
	__or__(span, objs) {
		if (__assert_num_args(span, 'set.__or__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__or__()')) return
		let s = new _Set()
		let set3 = __new_obj('set', new Map())
		let l = __set_to_list(objs[0])
		for (let e of l)
			s.add(span, [set3, e])
		l = __set_to_list(objs[1])
		for (let e of l)
			s.add(span, [set3, e])
		return set3
	}
	__sub__(span, objs) {
		if (__assert_num_args(span, 'set.__sub__()', objs, [2])) return
		if (__assert_type(span, objs[1], 'set', 'set.__sub__()')) return
		let s = new _Set()
		let set3 = __new_obj('set', new Map())
		let l = __set_to_list(objs[0])
		for (let e of l) {
			let isin = s.__contains__(span, [objs[1], e])
			if (! isin.value)
				s.add(span, [set3, e])
		}
		return set3
	}
}
runtime.fetch_text_cache.set("/web/py_lib/time.py", "\nimport _thread\n\ndef sleep(timeout):\n\tlock = _thread.allocate_lock()\n\tlock.acquire()\n\tlock.acquire(timeout=timeout)\n\ndef time():\n\treturn __rt_time()\n")
runtime.fetch_text_cache.set("/web/py_lib/textwrap.py", "\ndef dedent(text):\n\treturn '\\n'.join([l.lstrip() for l in text.split('\\n')])\n\n")
runtime.fetch_text_cache.set("/web/py_lib/_stdlib.py", "\ndef sum(list):\n\ts = 0\n\tfor x in list:\n\t\ts = s + x\n\treturn s\n\ndef enumerate(list):\n\ti = 0\n\tfor x in list:\n\t\tyield i,x\n\t\ti = i + 1\n\ndef zip(*lis):\n\tassert len(lis)>0\n\tits = []\n\tfor li in lis:\n\t\tits.append(iter(li))\n\twhile True:\n\t\tres = [next(it) for it in its]\n\t\tif len(res)<len(its):\n\t\t\traise StopIteration()\n\t\tyield res\n\ndef max(*arr):\n\tm = arr[0]\n\tfor e in arr:\n\t\tif m<e:\n\t\t\tm = e\n\treturn m\n\ndef min(*arr):\n\tm = arr[0]\n\tfor e in arr:\n\t\tif m>e:\n\t\t\tm = e\n\treturn m\n")
runtime.fetch_text_cache.set("/web/py_lib/_io.py", "\nclass TextIOWrapper:\n\tdef __init__(self,filename,mode,text):\n\t\tself.mode = mode\n\t\tself.filename = filename\n\t\tself.text = text if text is not None else ''\n\t\tif mode == 'r':\n\t\t\tif text is None:\n\t\t\t\traise FileNotFoundError(f\"[Errno 2] No such file or directory: '{filename}'\")\n\t\t\tself._rp = 0\n\t\t\tself._wp = None\n\t\telif mode == 'w':\n\t\t\tself.text = ''\n\t\t\tself._rp = None\n\t\t\tself._wp = 0\n\t\telif mode == 'x':\n\t\t\tif self.text is not None:\n\t\t\t\traise FileExistsError(f\"[Errno 17] File exists: '{filename}'\")\n\t\t\tself.text = ''\n\t\t\tself._rp = None\n\t\t\tself._wp = 0\n\t\telif mode in ('r+', '+', 'w+'):\n\t\t\tif self.text is None:\n\t\t\t\tself.text = ''\n\t\t\tself._rp = 0\n\t\t\tself._wp = 0\n\t\telif mode in ('a', 'a+'):\n\t\t\tself.text = text\n\t\t\tself._rp = 0\n\t\t\tself._wp = len(text)\n\t\telse:\n\t\t\traise ValueError(f\"Unsupported mode: '{mode}'\")\n\tdef __enter__(self):\n\t\treturn self\n\tdef __exit__(self,ex_type,ex_value,ex_stack):\n\t\tself.close()\n\tdef read(self):\n\t\tif self._rp is None:\n\t\t\traise UnsupportedOperation('not readable')\n\t\tif self._rp > 0:\n\t\t\treturn self.text[self._rp:]\n\t\treturn self.text\n\tdef readline(self):\n\t\tif self._rp is None:\n\t\t\traise UnsupportedOperation('not readable')\n\t\tif self._rp == len(self.text):\n\t\t\treturn None\n\t\trp = self._rp\n\t\twhile (rp < len(self.text)):\n\t\t\tif self.text[rp] == '\\n': break\n\t\t\trp = rp + 1\n\t\ttext = self.text[self._rp:rp]\n\t\tself._rp = rp if rp == len(self.text) else rp+1\n\t\treturn text\n\tdef readlines(self):\n\t\twhile True:\n\t\t\tline = self.readline()\n\t\t\tif line is None: break\n\t\t\tyield line\n\tdef truncate(self):\n\t\tif self._wp is None:\n\t\t\traise UnsupportedOperation('not writable')\n\t\tself.text = ''\n\t\tself._wp = 0\n\tdef write(self,text):\n\t\tif self._wp is None:\n\t\t\traise UnsupportedOperation('not writable')\n\t\ttail = ''\n\t\tif len(self.text) > (self._wp+len(text)):\n\t\t\ttail = self.text[self._wp+len(text):]\n\t\tself.text = (self.text[:self._wp] + text) + tail\n\t\tself._wp = self._wp + len(text)\n\tdef seek(self, p):\n\t\tif self._rp is not None:\n\t\t\tself._rp = p\n\t\tif self._wp is not None:\n\t\t\tself._wp = p\n\tdef close(self):\n\t\tif self.mode != 'r':\n\t\t\t__rt_save_file(self.filename, self.text)\n")
runtime.fetch_text_cache.set("/web/py_lib/traceback.py", "\ndef format_exc():\n\treturn __rt_format_exc()")
runtime.fetch_text_cache.set("/web/py_lib/urllib/request.py", "\ndef urlopen(url):\n\treturn open(url)")
runtime.fetch_text_cache.set("/web/py_lib/random.py", "\ndef random():\n\treturn javascript.Math.random().data()\n\ndef randint(min, max):\n\treturn min + int(random() * ((max+1)-min))\n\ndef choice(list):\n\ti = randint(0,len(list)-1)\n\treturn list[i]\n\ndef choices(a,k,weights=None,cum_weights=None):\n\tif weights is None:\n\t\tweights = [1 for i in range(len(a))]\n\ts = 0\n\tif cum_weights is None:\n\t\tcum_weights = []\n\t\tfor w in weights:\n\t\t\ts = s + w\n\t\t\tcum_weights.append(s)\n\tif s != 0:\n\t\tcum_weights = [w/s for w in cum_weights]\n\tres = []\n\tfor i in range(k):\n\t\tr = random()\n\t\tfor w,x in zip(cum_weights,a):\n\t\t\tif r < w:\n\t\t\t\tres.append(x)\n\t\t\t\tbreak\n\treturn res\n\ndef shuffle(list):\n\tl = len(list)-1\n\tfor i in range(l):\n\t\tr = randint(0,(l-1)-i)\n\t\tt = list[l-i]\n\t\tlist[l-i] = list[r]\n\t\tlist[r] = t\n\ndef sample(l, k):\n\tif (k<0) or (k>len(l)):\n\t\traise ValueError('Sample larger than population or is negative')\n\tidx = [i for i in range(len(l))]\n\tshuffle(idx)\n\tidx = idx[:k]\n\treturn [l[i] for i in idx]\n\n")
runtime.fetch_text_cache.set("/web/py_lib/threading.py", "import _thread\n\nclass Thread:\n    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):\n        self.target = target\n        self.args = args\n        self.kwargs = {} if kwargs is None else kwargs\n\n    def start(self):\n        _thread.start_new_thread(self.run, ())\n\n    def run(self):\n        self.target(*self.args, **self.kwargs)")
runtime.fetch_text_cache.set("/web/py_lib/os/path.py", "\ndef exists(path):\n\tl = listdir('.')\n\treturn path in l\n\ndef listdir(path):\n\treturn __rt_listdir(path)\n\ndef isdir(path):\n\treturn False\n\ndef isfile(path):\n\treturn exists(path)\n")
runtime.fetch_text_cache.set("/web/py_lib/math.py", "\n\npi = 3.141592653589793\ne = 2.718281828459045\ntau = 6.283185307179586\ninf = javascript.Infinity.data()\nnan = javascript.Number.NaN.data()\n\ndef ceil(x):\n\treturn javascript.Math.ceil(x).data()\n\ndef floor(x):\n\treturn javascript.Math.floor(x).data()\n\ndef abs(x):\n\treturn javascript.Math.abs(x).data()\n\ndef fabs(x):\n\treturn float(javascript.Math.abs(x).data())\n\ndef factorial(x):\n\tf = 1\n\tfor i in range(2, x+1):\n\t\tf = f * i\n\treturn f\n\ndef exp(x):\n\treturn float(javascript.Math.exp(x).data())\n\t\ndef log(x):\n\treturn float(javascript.Math.log(x).data())\n\t\ndef log2(x):\n\treturn float(javascript.Math.log2(x).data())\n\t\ndef log10(x):\n\treturn float(javascript.Math.log10(x).data())\n\t\ndef pow(x,y):\n\treturn float(javascript.Math.pow(x,y).data())\n\t\ndef sqrt(x):\n\treturn float(javascript.Math.sqrt(x).data())\n\t\ndef acos(x):\n\treturn float(javascript.Math.acos(x).data())\n\t\ndef asin(x):\n\treturn float(javascript.Math.asin(x).data())\n\t\ndef atan(x):\n\treturn float(javascript.Math.atan(x).data())\n\t\t\ndef cos(x):\n\treturn float(javascript.Math.cos(x).data())\n\t\ndef sin(x):\n\treturn float(javascript.Math.sin(x).data())\n\t\ndef tan(x):\n\treturn float(javascript.Math.tan(x).data())\n\t\ndef hypot(x):\n\treturn float(javascript.Math.hypot(x).data())\n\t\n")
runtime.fetch_text_cache.set("/web/py_lib/_thread.py", "\ndef start_new_thread(func, argv, **kwargs):\n\tif not callable(func):\n\t\traise TypeError('First arg must be callable')\n\tif not isinstance(argv, tuple):\n\t\traise('2nd arg must be a tuple')\n\treturn __rt_start_new_thread(func, argv, **kwargs) # builtin\ndef allocate_lock():\n\treturn lock()\n\ndef exit():\n\traise SystemExit()\n\ndef get_ident():\n\treturn __rt_get_ident() # builtin\n\nclass lock:\n\tdef __init__(self):\n\t\tself.__locked = False\n\tdef __repr__(self):\n\t\treturn f\"<{'locked' if self.__locked else 'unlocked'} _thread.lock object>\"\n\tdef acquire(self, waitflag=1, timeout=-1):\n\t\tif not self.__locked:\n\t\t\tself.__locked = True\n\t\t\treturn True\n\t\tif (waitflag == 0):\n\t\t\treturn False\n\t\treturn __rt_acquire_lock(self, timeout) # builtin\n\tdef release(self):\n\t\tif not self.__locked:\n\t\t\traise RuntimeError('release unlocked lock')\n\t\tself.__locked = False\n\t\t__rt_release_lock(self) # builtin\n\tdef locked(self):\n\t\treturn self.__locked\n")
runtime.fetch_text_cache.set("/web/py_lib/json.py", "\ndef dumps(obj):\n\treturn javascript.JSON.stringify(obj).data()\n\ndef loads(text):\n\treturn javascript.JSON.parse(text).data()\n\ndef dump(obj, fp):\n\ttext = javascript.JSON.stringify(obj).data()\n\tfp.write(text)\n\ndef load(fp):\n\ttext = fp.read()\n\treturn loads(text)\n\n")
runtime.fetch_text_cache.set("/web/py_lib/sys.py", "\nargv = __rt_argv()\n\ndef exit(code=0):\n\traise SystemExit()\n\ndef exc_info():\n\treturn __rt_exc_info()\n")
let lex = null
let parser = null
let tree = null

function jswrt_init() {
	lex = new Lex()
	parser = new LineParser()
	tree = new Tree()

	lex.matchers.push(new TextMatcher("','", ","))
	lex.matchers.push(new TextMatcher("'pass'", "pass"))
	lex.matchers.push(new TextMatcher("'global'", "global"))
	lex.matchers.push(new TextMatcher("'nonlocal'", "nonlocal"))
	lex.matchers.push(new TextMatcher("'class'", "class"))
	lex.matchers.push(new TextMatcher("':'", ":"))
	lex.matchers.push(new TextMatcher("'('", "("))
	lex.matchers.push(new TextMatcher("')'", ")"))
	lex.matchers.push(new TextMatcher("'def'", "def"))
	lex.matchers.push(new TextMatcher("'**'", "**"))
	lex.matchers.push(new TextMatcher("'*'", "*"))
	lex.matchers.push(new TextMatcher("'='", "="))
	lex.matchers.push(new TextMatcher("'if'", "if"))
	lex.matchers.push(new TextMatcher("'elif'", "elif"))
	lex.matchers.push(new TextMatcher("'else'", "else"))
	lex.matchers.push(new TextMatcher("'for'", "for"))
	lex.matchers.push(new TextMatcher("'in'", "in"))
	lex.matchers.push(new TextMatcher("'while'", "while"))
	lex.matchers.push(new TextMatcher("'assert'", "assert"))
	lex.matchers.push(new TextMatcher("'return'", "return"))
	lex.matchers.push(new TextMatcher("'yield'", "yield"))
	lex.matchers.push(new TextMatcher("'raise'", "raise"))
	lex.matchers.push(new TextMatcher("'break'", "break"))
	lex.matchers.push(new TextMatcher("'continue'", "continue"))
	lex.matchers.push(new TextMatcher("'try'", "try"))
	lex.matchers.push(new TextMatcher("'except'", "except"))
	lex.matchers.push(new TextMatcher("'as'", "as"))
	lex.matchers.push(new TextMatcher("'finally'", "finally"))
	lex.matchers.push(new TextMatcher("';'", ";"))
	lex.matchers.push(new TextMatcher("'del'", "del"))
	lex.matchers.push(new TextMatcher("'None'", "None"))
	lex.matchers.push(new TextMatcher("'True'", "True"))
	lex.matchers.push(new TextMatcher("'False'", "False"))
	lex.matchers.push(new TextMatcher("'lambda'", "lambda"))
	lex.matchers.push(new TextMatcher("'not'", "not"))
	lex.matchers.push(new TextMatcher("'is'", "is"))
	lex.matchers.push(new TextMatcher("'['", "["))
	lex.matchers.push(new TextMatcher("']'", "]"))
	lex.matchers.push(new TextMatcher("'{'", "{"))
	lex.matchers.push(new TextMatcher("'}'", "}"))
	lex.matchers.push(new TextMatcher("'.'", "."))
	lex.matchers.push(new TextMatcher("'import'", "import"))
	lex.matchers.push(new TextMatcher("'from'", "from"))
	lex.matchers.push(new TextMatcher("'with'", "with"))

	lex.matchers.push(new SymbolMatcher("$int", match_lex_int))
	lex.matchers.push(new SymbolMatcher("$float", match_lex_float))
	lex.matchers.push(new SymbolMatcher("$op", match_lex_op))
	lex.matchers.push(new SymbolMatcher("$id", match_lex_id))
	lex.matchers.push(new SymbolMatcher("$text", match_lex_text))
	lex.matchers.push(new SymbolMatcher("$multitext", match_lex_multitext))
	lex.matchers.push(new SymbolMatcher("$formattext", match_lex_formattext))
	lex.matchers.push(new SymbolMatcher("$comment", match_lex_comment))

	parser.add_rule(new Rule(null, "#pass", "<-", ["'pass'"]))
	parser.add_rule(new Rule(null, "#bind", "<-", ["'global'", "$id+,"]))
	parser.add_rule(new Rule(null, "#bind", "<-", ["'nonlocal'", "$id+,"]))
	parser.add_rule(new Rule(null, "#class", "<-", ["'class'", "$id", "':'"]))
	parser.add_rule(new Rule(_tx_class_id_exp, "#class", "<-", ["'class'", "$id", "'('", "exp+,", "')'", "':'"]))
	parser.add_rule(new Rule(null, "#def", "<-", ["'def'", "$id", "'('", "')'", "':'"]))
	parser.add_rule(new Rule(_tx_def_id_param, "#def", "<-", ["'def'", "$id", "'('", "param+,", "')'", "':'"]))
	parser.add_rule(new Rule(_tx_def_id_param_comma, "#def", "<-", ["'def'", "$id", "'('", "param+,", "','", "')'", "':'"]))
	parser.add_rule(new Rule(_tx_def_id_param_id, "#def", "<-", ["'def'", "$id", "'('", "param+,", "','", "'**'", "$id", "')'", "':'"]))
	parser.add_rule(new Rule(_tx_def_id_param_id_comma, "#def", "<-", ["'def'", "$id", "'('", "param+,", "','", "'**'", "$id", "','", "')'", "':'"]))
	parser.add_rule(new Rule(null, "param", "<-", ["$id"]))
	parser.add_rule(new Rule(null, "param", "<-", ["'*'", "$id"]))
	parser.add_rule(new Rule(null, "param", "<-", ["$id", "'='", "exp"]))
	parser.add_rule(new Rule(null, "#if", "<-", ["if_", "':'"]))
	parser.add_rule(new Rule(_tx_if_exp, "if_", "<-", ["'if'", "exp"]))
	parser.add_rule(new Rule(_tx_elif_exp, "#elif", "<-", ["'elif'", "exp", "':'"]))
	parser.add_rule(new Rule(_tx_else, "#else", "<-", ["'else'", "':'"]))
	parser.add_rule(new Rule(null, "#for", "<-", ["for_", "':'"]))
	parser.add_rule(new Rule(_tx_for_id_in_exp, "for_", "<-", ["'for'", "lexp+,", "'in'", "exp"]))
	parser.add_rule(new Rule(_tx_while_exp, "#while", "<-", ["'while'", "exp", "':'"]))
	parser.add_rule(new Rule(_tx_assign_lexp_exp, "#assign", "<-", ["lexp+,", "'='", "exp+,"]))
	parser.add_rule(new Rule(null, "#call", "<-", ["fun_call"]))
	parser.add_rule(new Rule(_tx_assert_assert_exp, "#assert", "<-", ["'assert'", "exp"]))
	parser.add_rule(new Rule(_tx_assert_assert_exp_exp, "#assert", "<-", ["'assert'", "exp", "','", "exp"]))
	parser.add_rule(new Rule(null, "#exit", "<-", ["'return'"]))
	parser.add_rule(new Rule(_tx_exit_return, "#exit", "<-", ["'return'", "exp+,"]))
	parser.add_rule(new Rule(_tx_exit_yield, "#exit", "<-", ["'yield'", "exp+,"]))
	parser.add_rule(new Rule(null, "#exit", "<-", ["'raise'"]))
	parser.add_rule(new Rule(_tx_exit_raise, "#exit", "<-", ["'raise'", "exp"]))
	parser.add_rule(new Rule(null, "#exit", "<-", ["'break'"]))
	parser.add_rule(new Rule(null, "#exit", "<-", ["'continue'"]))
	parser.add_rule(new Rule(null, "#try", "<-", ["'try'", "':'"]))
	parser.add_rule(new Rule(_tx_except, "#except", "<-", ["'except'", "':'"]))
	parser.add_rule(new Rule(_tx_except_id, "#except", "<-", ["'except'", "$id+,", "':'"]))
	parser.add_rule(new Rule(_tx_except_id_as_id, "#except", "<-", ["'except'", "$id+,", "'as'", "$id", "':'"]))
	parser.add_rule(new Rule(_tx_finally, "#finally", "<-", ["'finally'", "':'"]))
	parser.add_rule(new Rule(null, "#semicolon", "<-", ["';'"]))
	parser.add_rule(new Rule(null, "#comment", "<-", ["$comment"]))
	parser.add_rule(new Rule(null, "#comment", "<-", ["$multitext"]))
	parser.add_rule(new Rule(null, "#del", "<-", ["'del'", "$id"]))
	parser.add_rule(new Rule(null, "#del", "<-", ["'del'", "item_exp"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["'None'"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["'True'"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["'False'"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["$int"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["$float"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["$id"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["fun_call"]))
	parser.add_rule(new Rule(_tx_fun_call_factor, "fun_call", "<-", ["factor", "'('", "')'"]))
	parser.add_rule(new Rule(_tx_fun_call_factor_arg_, "fun_call", "<-", ["factor", "'('", "arg+,", "')'"]))
	parser.add_rule(new Rule(_tx_fun_call_factor_arg_2, "fun_call", "<-", ["factor", "'('", "arg+,", "','", "')'"]))
	parser.add_rule(new Rule(null, "arg", "<-", ["exp"]))
	parser.add_rule(new Rule(null, "arg", "<-", ["$id", "'='", "exp"]))
	parser.add_rule(new Rule(null, "arg", "<-", ["'*'", "exp"]))
	parser.add_rule(new Rule(null, "arg", "<-", ["'**'", "exp"]))
	parser.add_rule(new Rule(_tx_exp_lambda, "exp", "<-", ["'lambda'", "param+,", "':'", "exp+,"]))
	parser.add_rule(new Rule(_tx_exp_if_exp_else_exp, "exp", "<-", ["exp", "'if'", "exp", "'else'", "exp"]))
	parser.add_rule(new Rule(_tx_exp_factor_op_factor, "exp", "<-", ["factor", "$op", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_in_factor, "exp", "<-", ["factor", "'in'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_not_in_factor, "exp", "<-", ["factor", "'not'", "'in'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_is_factor, "exp", "<-", ["factor", "'is'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_is_not_factor, "exp", "<-", ["factor", "'is'", "'not'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_mul_factor, "exp", "<-", ["factor", "'*'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_factor_pow_factor, "exp", "<-", ["factor", "'**'", "factor"]))
	parser.add_rule(new Rule(_tx_exp_op_factor, "exp", "<-", ["$op", "factor"]))
	parser.add_rule(new Rule(_tx_exp_not_factor, "exp", "<-", ["'not'", "factor"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["'('", "exp", "')'"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["$text"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["$multitext"]))
	parser.add_rule(new Rule(_tx_factor_formattext, "factor", "<-", ["$formattext"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["list"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["tuple"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["dict"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["set"]))
	parser.add_rule(new Rule(_tx_list_exp_plus, "list", "<-", ["'['", "exp+,", "']'"]))
	parser.add_rule(new Rule(_tx_list_exp_plus_, "list", "<-", ["'['", "exp+,", "','", "']'"]))
	parser.add_rule(new Rule(null, "list", "<-", ["'['", "']'"]))
	parser.add_rule(new Rule(_tx_list_exp_generator, "list", "<-", ["'['", "exp", "gen_", "']'"]))
	parser.add_rule(new Rule(_tx_tuple_exp_plus_exp, "tuple", "<-", ["'('", "exp+,", "','", "exp", "')'"]))
	parser.add_rule(new Rule(_tx_tuple_exp_plus_exp_, "tuple", "<-", ["'('", "exp+,", "','", "exp", "','", "')'"]))
	parser.add_rule(new Rule(_tx_tuple_exp, "tuple", "<-", ["'('", "exp", "','", "')'"]))
	parser.add_rule(new Rule(null, "tuple", "<-", ["'('", "')'"]))
	parser.add_rule(new Rule(_tx_tuple_exp_generator, "tuple", "<-", ["'('", "exp", "gen_", "')'"]))
	parser.add_rule(new Rule(null, "gen_", "<-", ["for_"]))
	parser.add_rule(new Rule(null, "gen_", "<-", ["gen_", "for_"]))
	parser.add_rule(new Rule(null, "gen_", "<-", ["gen_", "if_"]))
	parser.add_rule(new Rule(_tx_set_exp_plus, "set", "<-", ["'{'", "exp+,", "'}'"]))
	parser.add_rule(new Rule(_tx_set_exp_generator, "set", "<-", ["'{'", "exp", "gen_", "'}'"]))
	parser.add_rule(new Rule(_tx_set_exp_plus_, "set", "<-", ["'{'", "exp+,", "','", "'}'"]))
	parser.add_rule(new Rule(null, "dict", "<-", ["'{'", "'}'"]))
	parser.add_rule(new Rule(_tx_dict_dict_item_plus, "dict", "<-", ["'{'", "dict_item+,", "'}'"]))
	parser.add_rule(new Rule(_tx_dict_dict_item_plus_, "dict", "<-", ["'{'", "dict_item+,", "','", "'}'"]))
	parser.add_rule(new Rule(_tx_dict_exp_exp_generator, "dict", "<-", ["'{'", "exp", "':'", "exp", "gen_", "'}'"]))
	parser.add_rule(new Rule(null, "dict_item", "<-", ["exp", "':'", "exp"]))
	parser.add_rule(new Rule(null, "exp", "<-", ["factor"]))
	parser.add_rule(new Rule(null, "lexp", "<-", ["$id"]))
	parser.add_rule(new Rule(null, "lexp", "<-", ["item_exp"]))
	parser.add_rule(new Rule(null, "lexp", "<-", ["attribute"]))
	parser.add_rule(new Rule(_tx_lexp_1, "lexp", "<-", ["'['", "lexp+,", "']'"]))
	parser.add_rule(new Rule(_tx_lexp_2, "lexp", "<-", ["'['", "lexp+,", "','", "']'"]))
	parser.add_rule(new Rule(_tx_lexp_3, "lexp", "<-", ["'('", "lexp+,", "')'"]))
	parser.add_rule(new Rule(_tx_lexp_4, "lexp", "<-", ["'('", "lexp+,", "','", "')'"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["item_exp"]))
	parser.add_rule(new Rule(null, "factor", "<-", ["attribute"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_0, "item_exp", "<-", ["factor", "'['", "':'", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_1, "item_exp", "<-", ["factor", "'['", "exp", "':'", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_2, "item_exp", "<-", ["factor", "'['", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_3, "item_exp", "<-", ["factor", "'['", "exp", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_4, "item_exp", "<-", ["factor", "'['", "exp", "':'", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_5, "item_exp", "<-", ["factor", "'['", "':'", "exp", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_6, "item_exp", "<-", ["factor", "'['", "':'", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_slice_7, "item_exp", "<-", ["factor", "'['", "exp", "':'", "exp", "':'", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_item_exp_factor_exp, "item_exp", "<-", ["factor", "'['", "exp", "']'"]))
	parser.add_rule(new Rule(_tx_attribute_factor_id, "attribute", "<-", ["factor", "'.'", "$id"]))
	parser.add_rule(new Rule(null, "#import", "<-", ["'import'", "$id"]))
	parser.add_rule(new Rule(null, "#import", "<-", ["'from'", "'.'", "'import'", "$id"]))
	parser.add_rule(new Rule(null, "#import", "<-", ["'from'", "$id", "'import'", "$id"]))
	parser.add_rule(new Rule(_tx_with_exp, "#with", "<-", ["'with'", "exp", "':'"]))
	parser.add_rule(new Rule(_tx_with_exp_as_id, "#with", "<-", ["'with'", "exp", "'as'", "$id", "':'"]))
	parser.add_rule(new Rule(_act_global, "#bind", "->", ["'global'", "$id+,"]))
	parser.add_rule(new Rule(_act_nonlocal, "#bind", "->", ["'nonlocal'", "$id+,"]))
	parser.add_rule(new Rule(null, "#comment", "->", ["$multitext"]))
	parser.add_rule(new Rule(_act_pass, "#pass", "->", ["'pass'"]))
	parser.add_rule(new Rule(_act_call, "#call", "->", ["fun_call"]))
	parser.add_rule(new Rule(_act_import, "#import", "->", ["'import'", "$id"]))
	parser.add_rule(new Rule(_act_from_dot_import, "#import", "->", ["'from'", "'.'", "'import'", "$id"]))
	parser.add_rule(new Rule(_act_from_import, "#import", "->", ["'from'", "$id", "'import'", "$id"]))
	parser.add_rule(new Rule(_act_assign, "#assign", "->", ["lexp+,", "'='", "exp+,"]))
	parser.add_rule(new Rule(_act_assert_assert_exp, "#assert", "->", ["'assert'", "exp"]))
	parser.add_rule(new Rule(_act_assert_assert_exp_exp, "#assert", "->", ["'assert'", "exp", "','", "exp"]))
	parser.add_rule(new Rule(_act_return_exp, "#exit", "->", ["'return'", "exp+,"]))
	parser.add_rule(new Rule(_act_return, "#exit", "->", ["'return'"]))
	parser.add_rule(new Rule(_act_yield_exp, "#exit", "->", ["'yield'", "exp+,"]))
	parser.add_rule(new Rule(_act_raise_exp, "#exit", "->", ["'raise'", "exp"]))
	parser.add_rule(new Rule(_act_raise, "#exit", "->", ["'raise'"]))
	parser.add_rule(new Rule(_act_break, "#exit", "->", ["'break'"]))
	parser.add_rule(new Rule(_act_continue, "#exit", "->", ["'continue'"]))
	parser.add_rule(new Rule(_act_del_id, "#del", "->", ["'del'", "$id"]))
	parser.add_rule(new Rule(_act_del_item_exp, "#del", "->", ["'del'", "item_exp"]))
	parser.add_rule(new Rule(_act_factor_none, "factor", "->", ["'None'"]))
	parser.add_rule(new Rule(_act_factor_true, "factor", "->", ["'True'"]))
	parser.add_rule(new Rule(_act_factor_false, "factor", "->", ["'False'"]))
	parser.add_rule(new Rule(_act_factor_int, "factor", "->", ["$int"]))
	parser.add_rule(new Rule(_act_factor_float, "factor", "->", ["$float"]))
	parser.add_rule(new Rule(_act_factor_id, "factor", "->", ["$id"]))
	parser.add_rule(new Rule(_act_factor_call, "factor", "->", ["fun_call"]))
	parser.add_rule(new Rule(_act_fun_call1, "fun_call", "->", ["factor", "'('", "')'"]))
	parser.add_rule(new Rule(_act_fun_call2, "fun_call", "->", ["factor", "'('", "arg+,", "')'"]))
	parser.add_rule(new Rule(_act_fun_call3, "fun_call", "->", ["factor", "'('", "arg+,", "','", "')'"]))
	parser.add_rule(new Rule(null, "factor", "->", ["list"]))
	parser.add_rule(new Rule(null, "factor", "->", ["tuple"]))
	parser.add_rule(new Rule(null, "factor", "->", ["dict"]))
	parser.add_rule(new Rule(null, "factor", "->", ["set"]))
	parser.add_rule(new Rule(_act_factor_attribute, "factor", "->", ["attribute"]))
	parser.add_rule(new Rule(_act_attribute_id, "attribute", "->", ["factor", "'.'", "$id"]))
	parser.add_rule(new Rule(_act_exp_if_exp_else_exp, "exp", "->", ["exp", "'if'", "exp", "'else'", "exp"]))
	parser.add_rule(new Rule(null, "exp", "->", ["factor"]))
	parser.add_rule(new Rule(_act_op, "exp", "->", ["factor", "$op", "factor"]))
	parser.add_rule(new Rule(_act_op_in, "exp", "->", ["factor", "'in'", "factor"]))
	parser.add_rule(new Rule(_act_op_not_in, "exp", "->", ["factor", "'not'", "'in'", "factor"]))
	parser.add_rule(new Rule(_act_op_is, "exp", "->", ["factor", "'is'", "factor"]))
	parser.add_rule(new Rule(_action_binary_op_is_not, "exp", "->", ["factor", "'is'", "'not'", "factor"]))
	parser.add_rule(new Rule(_act_star, "exp", "->", ["factor", "'*'", "factor"]))
	parser.add_rule(new Rule(_act_star2, "exp", "->", ["factor", "'**'", "factor"]))
	parser.add_rule(new Rule(_act_exp_op_1, "exp", "->", ["$op", "factor"]))
	parser.add_rule(new Rule(_act_exp_op_not, "exp", "->", ["'not'", "factor"]))
	parser.add_rule(new Rule(_act_exp_r, "factor", "->", ["'('", "exp", "')'"]))
	parser.add_rule(new Rule(_act_text, "factor", "->", ["$text"]))
	parser.add_rule(new Rule(_act_multitext, "factor", "->", ["$multitext"]))
	parser.add_rule(new Rule(_act_factor_item_exp, "factor", "->", ["item_exp"]))
	parser.add_rule(new Rule(_act_list, "list", "->", ["'['", "exp+,", "']'"]))
	parser.add_rule(new Rule(_act_list_2, "list", "->", ["'['", "exp+,", "','", "']'"]))
	parser.add_rule(new Rule(_act_list_empty, "list", "->", ["'['", "']'"]))
	parser.add_rule(new Rule(_act_tuple, "tuple", "->", ["'('", "exp+,", "','", "exp", "')'"]))
	parser.add_rule(new Rule(_act_tuple_2, "tuple", "->", ["'('", "exp+,", "','", "exp", "','", "')'"]))
	parser.add_rule(new Rule(_act_tuple_1, "tuple", "->", ["'('", "exp", "','", "')'"]))
	parser.add_rule(new Rule(_act_tuple_empty, "tuple", "->", ["'('", "')'"]))
	parser.add_rule(new Rule(_act_set, "set", "->", ["'{'", "exp+,", "'}'"]))
	parser.add_rule(new Rule(_act_set_2, "set", "->", ["'{'", "exp+,", "','", "'}'"]))
	parser.add_rule(new Rule(_act_dict_empty, "dict", "->", ["'{'", "'}'"]))
	parser.add_rule(new Rule(_act_dict, "dict", "->", ["'{'", "dict_item+,", "'}'"]))
	parser.add_rule(new Rule(_act_dict_2, "dict", "->", ["'{'", "dict_item+,", "','", "'}'"]))
	parser.add_rule(new Rule(_act_dict_item, "dict_item", "->", ["exp", "':'", "exp"]))
	parser.add_rule(new Rule(null, "lexp", "->", ["attribute"]))
	parser.add_rule(new Rule(null, "lexp", "->", ["item_exp"]))
	parser.add_rule(new Rule(_act_lexp_id, "lexp", "->", ["$id"]))
	parser.add_rule(new Rule(_act_item_exp, "item_exp", "->", ["factor", "'['", "exp", "']'"]))

	tree.rules.set("#def", _act_tree_def)
	tree.rules.set("#if", _act_tree_if)
	tree.rules.set("#else", _act_tree_else)
	tree.rules.set("#try", _act_tree_try)
	tree.rules.set("#except", _act_tree_except)
	tree.rules.set("#finally", _act_tree_finally)
	tree.rules.set("#while", _act_tree_while)
	tree.rules.set("#class", _act_tree_class)

	__builtins.set("type", __make_builtin_class(_Type, "type"))
	__builtins.set("builtin_function_or_method", __make_builtin_class(_builtin_function_or_method, "builtin_function_or_method"))
	__builtins.set("method", __make_builtin_class(_class_method, "method"))
	__builtins.set("function", __make_builtin_class(_class_function, "function"))
	__builtins.set("module", __make_builtin_class(_class_module, "module"))
	__builtins.set("object", __make_builtin_class(_Object, "object"))
	__builtins.set("super", __make_builtin_class(_Super, "super"))
	__builtins.set("BaseException", __make_builtin_class(_BaseException, "BaseException"))
	__builtins.set("SystemExit", __make_builtin_class(_SystemExit, "SystemExit"))
	__builtins.set("KeyboardInterrupt", __make_builtin_class(_KeyboardInterrupt, "KeyboardInterrupt"))
	__builtins.set("GeneratorExit", __make_builtin_class(_GeneratorExit, "GeneratorExit"))
	__builtins.set("Exception", __make_builtin_class(_Exception, "Exception"))
	__builtins.set("StopIteration", __make_builtin_class(_StopIteration, "StopIteration"))
	__builtins.set("StopAsyncIteration", __make_builtin_class(_StopAsyncIteration, "StopAsyncIteration"))
	__builtins.set("ArithmeticError", __make_builtin_class(_ArithmeticError, "ArithmeticError"))
	__builtins.set("FloatingPointError", __make_builtin_class(_FloatingPointError, "FloatingPointError"))
	__builtins.set("OverflowError", __make_builtin_class(_OverflowError, "OverflowError"))
	__builtins.set("ZeroDivisionError", __make_builtin_class(_ZeroDivisionError, "ZeroDivisionError"))
	__builtins.set("AssertionError", __make_builtin_class(_AssertionError, "AssertionError"))
	__builtins.set("AttributeError", __make_builtin_class(_AttributeError, "AttributeError"))
	__builtins.set("BufferError", __make_builtin_class(_BufferError, "BufferError"))
	__builtins.set("EOFError", __make_builtin_class(_EOFError, "EOFError"))
	__builtins.set("ImportError", __make_builtin_class(_ImportError, "ImportError"))
	__builtins.set("ModuleNotFoundError", __make_builtin_class(_ModuleNotFoundError, "ModuleNotFoundError"))
	__builtins.set("LookupError", __make_builtin_class(_LookupError, "LookupError"))
	__builtins.set("IndexError", __make_builtin_class(_IndexError, "IndexError"))
	__builtins.set("KeyError", __make_builtin_class(_KeyError, "KeyError"))
	__builtins.set("MemoryError", __make_builtin_class(_MemoryError, "MemoryError"))
	__builtins.set("NameError", __make_builtin_class(_NameError, "NameError"))
	__builtins.set("UnboundLocalError", __make_builtin_class(_UnboundLocalError, "UnboundLocalError"))
	__builtins.set("OSError", __make_builtin_class(_OSError, "OSError"))
	__builtins.set("BlockingIOError", __make_builtin_class(_BlockingIOError, "BlockingIOError"))
	__builtins.set("ChildProcessError", __make_builtin_class(_ChildProcessError, "ChildProcessError"))
	__builtins.set("ConnectionError", __make_builtin_class(_ConnectionError, "ConnectionError"))
	__builtins.set("BrokenPipeError", __make_builtin_class(_BrokenPipeError, "BrokenPipeError"))
	__builtins.set("ConnectionAbortedError", __make_builtin_class(_ConnectionAbortedError, "ConnectionAbortedError"))
	__builtins.set("ConnectionRefusedError", __make_builtin_class(_ConnectionRefusedError, "ConnectionRefusedError"))
	__builtins.set("ConnectionResetError", __make_builtin_class(_ConnectionResetError, "ConnectionResetError"))
	__builtins.set("FileExistsError", __make_builtin_class(_FileExistsError, "FileExistsError"))
	__builtins.set("FileNotFoundError", __make_builtin_class(_FileNotFoundError, "FileNotFoundError"))
	__builtins.set("InterruptedError", __make_builtin_class(_InterruptedError, "InterruptedError"))
	__builtins.set("IsADirectoryError", __make_builtin_class(_IsADirectoryError, "IsADirectoryError"))
	__builtins.set("NotADirectoryError", __make_builtin_class(_NotADirectoryError, "NotADirectoryError"))
	__builtins.set("PermissionError", __make_builtin_class(_PermissionError, "PermissionError"))
	__builtins.set("ProcessLookupError", __make_builtin_class(_ProcessLookupError, "ProcessLookupError"))
	__builtins.set("TimeoutError", __make_builtin_class(_TimeoutError, "TimeoutError"))
	__builtins.set("ReferenceError", __make_builtin_class(_ReferenceError, "ReferenceError"))
	__builtins.set("RuntimeError", __make_builtin_class(_RuntimeError, "RuntimeError"))
	__builtins.set("NotImplementedError", __make_builtin_class(_NotImplementedError, "NotImplementedError"))
	__builtins.set("RecursionError", __make_builtin_class(_RecursionError, "RecursionError"))
	__builtins.set("SyntaxError", __make_builtin_class(_SyntaxError, "SyntaxError"))
	__builtins.set("LexicalError", __make_builtin_class(_LexicalError, "LexicalError"))
	__builtins.set("IndentationError", __make_builtin_class(_IndentationError, "IndentationError"))
	__builtins.set("TabError", __make_builtin_class(_TabError, "TabError"))
	__builtins.set("SystemError", __make_builtin_class(_SystemError, "SystemError"))
	__builtins.set("TypeError", __make_builtin_class(_TypeError, "TypeError"))
	__builtins.set("ValueError", __make_builtin_class(_ValueError, "ValueError"))
	__builtins.set("UnicodeError", __make_builtin_class(_UnicodeError, "UnicodeError"))
	__builtins.set("UnicodeDecodeError", __make_builtin_class(_UnicodeDecodeError, "UnicodeDecodeError"))
	__builtins.set("UnicodeEncodeError", __make_builtin_class(_UnicodeEncodeError, "UnicodeEncodeError"))
	__builtins.set("UnicodeTranslateError", __make_builtin_class(_UnicodeTranslateError, "UnicodeTranslateError"))
	__builtins.set("Warning", __make_builtin_class(_Warning, "Warning"))
	__builtins.set("DeprecationWarning", __make_builtin_class(_DeprecationWarning, "DeprecationWarning"))
	__builtins.set("PendingDeprecationWarning", __make_builtin_class(_PendingDeprecationWarning, "PendingDeprecationWarning"))
	__builtins.set("RuntimeWarning", __make_builtin_class(_RuntimeWarning, "RuntimeWarning"))
	__builtins.set("SyntaxWarning", __make_builtin_class(_SyntaxWarning, "SyntaxWarning"))
	__builtins.set("UserWarning", __make_builtin_class(_UserWarning, "UserWarning"))
	__builtins.set("FutureWarning", __make_builtin_class(_FutureWarning, "FutureWarning"))
	__builtins.set("ImportWarning", __make_builtin_class(_ImportWarning, "ImportWarning"))
	__builtins.set("UnicodeWarning", __make_builtin_class(_UnicodeWarning, "UnicodeWarning"))
	__builtins.set("BytesWarning", __make_builtin_class(_BytesWarning, "BytesWarning"))
	__builtins.set("ResourceWarning", __make_builtin_class(_ResourceWarning, "ResourceWarning"))
	__builtins.set("NoneType", __make_builtin_class(_NoneType, "NoneType"))
	__builtins.set("generator", __make_builtin_class(_Generator, "generator"))
	__builtins.set("int", __make_builtin_class(_Int, "int"))
	__builtins.set("float", __make_builtin_class(_Float, "float"))
	__builtins.set("bool", __make_builtin_class(_Bool, "bool"))
	__builtins.set("JSObject", __make_builtin_class(_JSObject, "JSObject"))
	__builtins.set("slice", __make_builtin_class(_Slice, "slice"))
	__builtins.set("str", __make_builtin_class(_Str, "str"))
	__builtins.set("range", __make_builtin_class(_Range, "range"))
	__builtins.set("_iterator", __make_builtin_class(_Iterator, "_iterator"))
	__builtins.set("list", __make_builtin_class(_List, "list"))
	__builtins.set("tuple", __make_builtin_class(_Tuple, "tuple"))
	__builtins.set("dict", __make_builtin_class(_Dict, "dict"))
	__builtins.set("set", __make_builtin_class(_Set, "set"))

	__builtins.set("print", __make_builtin_function(__builtin_print, "print"))
	__builtins.set("input", __make_builtin_function(__builtin_input, "input"))
	__builtins.set("__rt_save_file", __make_builtin_function(__rt_save_file, "__rt_save_file"))
	__builtins.set("open", __make_builtin_function(__builtin_open, "open"))
	__builtins.set("__rt_listdir", __make_builtin_function(__rt_listdir, "__rt_listdir"))
	__builtins.set("id", __make_builtin_function(__builtin_id, "id"))
	__builtins.set("hash", __make_builtin_function(__builtin_hash, "hash"))
	__builtins.set("iter", __make_builtin_function(__builtin_iter, "iter"))
	__builtins.set("next", __make_builtin_function(__builtin_next, "next"))
	__builtins.set("getattr", __make_builtin_function(__builtin_getattr, "getattr"))
	__builtins.set("setattr", __make_builtin_function(__builtin_setattr, "setattr"))
	__builtins.set("hasattr", __make_builtin_function(__builtin_hasattr, "hasattr"))
	__builtins.set("callable", __make_builtin_function(__builtin_callable, "callable"))
	__builtins.set("issubclass", __make_builtin_function(__builtin_issubclass, "issubclass"))
	__builtins.set("isinstance", __make_builtin_function(__builtin_isinstance, "isinstance"))
	__builtins.set("len", __make_builtin_function(__builtin_len, "len"))
	__builtins.set("round", __make_builtin_function(__builtin_round, "round"))
	__builtins.set("__rt_time", __make_builtin_function(__rt_time, "__rt_time"))
	__builtins.set("__rt_get_ident", __make_builtin_function(__rt_get_ident, "__rt_get_ident"))
	__builtins.set("__rt_start_new_thread", __make_builtin_function(__rt_start_new_thread, "__rt_start_new_thread"))
	__builtins.set("__rt_acquire_lock", __make_builtin_function(__rt_acquire_lock, "__rt_acquire_lock"))
	__builtins.set("__rt_release_lock", __make_builtin_function(__rt_release_lock, "__rt_release_lock"))
	__builtins.set("sorted", __make_builtin_function(__builtin_sorted, "sorted"))
	__builtins.set("dir", __make_builtin_function(__builtin_dir, "dir"))
	__builtins.set("vars", __make_builtin_function(__builtin_vars, "vars"))
	__builtins.set("__rt_argv", __make_builtin_function(__rt_argv, "__rt_argv"))
	__builtins.set("__rt_format_exc", __make_builtin_function(__rt_format_exc, "__rt_format_exc"))
	__builtins.set("__rt_exc_info", __make_builtin_function(__rt_exc_info, "__rt_exc_info"))
	__builtins.set("app123_event", __make_builtin_function(__app123_event, "app123_event"))
}

runtime._init = jswrt_init
return runtime }
