// This is a rather clever hack based on Raymond Hill's "HTML text
// hilighter" (http://www.raymondhill.net/blog/?p=272).
//
// We need to work on fragments of text in a document.  We want to
// highlight them, or set event listeners and wotnot.  Problem is,
// these text fragments may span across elements in the document, so
// we won't have a single node to work with.  Instead, each text
// fragment will be split in a sequence of nodes, inserted as children
// of the original nodes that contained pieces of the text.
//
// The class below does this processing.  Upon creation, it scans the
// tree from the designated root downwards and constructs a single
// string that can be accessed in the member variable 'text'.  This
// string can be used to obtain ranges (via matching regular
// expressions or whatever), which can then be passed to the method
// slice(), which will modify the document, adding span elements as
// appropriate, and return the array of spans enclosing the parts of
// the range.

function TreeSlicer( root ) {
	// Privates
	var
	HTML_IGNORE = {
		// Document metadata. We really shouldn't encounter these, ever.
		head: true,
		title: true,
		base: true,
		link: true,
		meta: true,
		style: true,
		// For completeness only, we also don't expect these:
		frameset: true, // deprecated
		frame: true, // deprecated
		noframes: true, // deprecated
		// Scripting
		script: true,
		// Embedded content, we don't look into these.
		img: true,
		iframe: true,
		embed: true,
		object: true,
		param: true,
		video: true,
		audio: true,
		source: true,
		track: true,
		canvas: true,
		map: true,
		area: true,
		svg: true,
		math: true,
		// Void table elements
		col: true,
		colgroup: true,
		// Void form elements
		input: true,
		button: true,
		select: true,
		datalist: true,
		optgroup: true,
		option: true,
		textarea: true,
		keygen: true,
		progress: true,
		meter: true,
		// misc
		command: true // deprecated anyway
	},
	// Block elements. Well, rather, elements that we consider to
	// introduce a line break when we convert to text.
	HTML_BLOCK = {
		// Here for completeness only
		html: true,
		body: true,
		// Sections
		section: true,
		nav: true,
		article: true,
		aside: true,
		h1: true,
		h2: true,
		h3: true,
		h4: true,
		h5: true,
		h6: true,
		header: true,
		footer: true,
		address: true,
		main: true,
		// Grouping
		p: true,
		hr: true,
		pre: true,
		blockquote: true,
		ol: true,
		ul: true,
		li: true,
		dl: true,
		dt: true,
		dd: true,
		figure: true,
		figcaption: true,
		div: true,
		// The BR
		br: true,
		// Tabular content
		table: true,
		caption: true,
		tbody: true,
		thead: true,
		tfoot: true,
		tr: true,
		// we add newlines after TDs and THs
		td: true,
		th: true,
		// Forms
		form: true,
		fieldset: true,
		legend: true,
		// other
		center: true, // deprecated
		dir: true, // deprecated
		menu: true,
		noscript: true
	};

	// The following recursive function is used below to recurse into
	// the DOM tree, extracting text.  At the end of the recursion,
	// context.chunks contains each text node found and the offset
	// into the text at which it occurs.
	function scanForText( slicer, node ) {
		switch ( node.nodeType ) {
		case 3:
			// A text node. Collect it.
			var text = node.nodeValue;
			if ( text.length > 0 ) {
				slicer.text.push( text );
				slicer.chunks.push({ o: slicer.textLength, n: node });
				slicer.textLength += text.length;
			}
			// else ignore empty texts (can this even happen?)
			break;

		case 1:
			// An element node.
			// If ignorable, ignore; else recurse into children.
			// If appropriate, append a linefeed to the text.
			var tag = node.tagName.toLowerCase();
			if ( !HTML_IGNORE[tag] ) {
				var children = node.childNodes;
				for ( var i = 0, end = children.length; i < end; i++ ) {
					scanForText( slicer, children[i] );
				}

				if ( HTML_BLOCK[tag] && slicer.text.length > 0 ) {
					slicer.text[ slicer.text.length - 1 ] += "\n";
					slicer.textLength++;
				}
			}
		}
	}

	this.root = root;
	this.doc = root.ownerDocument;
	this.text = []; // will be joined into a single string after scan
	this.textLength = 0;
	this.chunks = [];

	scanForText( this, root );

	this.text = this.text.join( '' );
	this.chunks.push({ o: this.text.length }); // sentinel
}

TreeSlicer.prototype = {
	// This is the method we want to use to "slice" a text fragment.
	//
	// Parameters 'start' and 'end' are offsets into this.text.  The
	// text fragment includes the character at this.text[start], and
	// runs up to, but not including, the character at this.text[end].
	// The method will identify all document nodes containing parts of
	// the text, and modify the tree so that each part is enclosed in
	// a span element (which may, and usually does mean splitting text
	// nodes).
	//
	// IMPORTANT: You may call this method repeatedly, but the ranges
	// in each call should be at increasing offsets and must not
	// overlap with ranges used in previous calls.
	//
	// The method returns an array of nodes. Each node is a span
	// element, and the whole set comprise the text you want.  You may
	// set all these spans to some class, or assign a style, or event
	// listeners or whatever.

	slice: function( start, end ) {
		var r = [], a, b;

		if ( start < 0 ) {
			start = 0;
		}

		if ( end > this.text.length ) {
			end = this.text.length;
		}

		if ( end <= start + 1 ) {
			return r;
		}

		// Find the entry in this.chunks which contains the first
		// character in the range, using Raymond's elegant binary
		// search.
		a = 0;
		b = this.chunks.length;
		while ( a < b ) {
			var i = a + b >> 1;
			if ( start < this.chunks[ i ].o ) {
				b = i;
			}
			else if ( start >= this.chunks[i + 1].o ) {
				a = i + 1;
			}
			else {
				a = b = i;
			}
		}

		// Now, for every entry in this.chunks which intersects with
		// the text fragment, extract the intersecting text and put it
		// into a span.
		while ( i < this.chunks.length ) {
			var entry = this.chunks[i],
				node = entry.n,
				parent = node.parentNode,
				nextNode = node.nextSibling,
				nodeText = node.nodeValue,
				nodeStart = start - entry.o,
				nodeEnd = Math.min( end, this.chunks[ i + 1 ].o ) - entry.o,
				before, middle, after;

			// before is the text in this node before the range
			if ( nodeStart > 0 ) {
				before = nodeText.substring( 0, nodeStart );
			}
			else {
				before = null;
			}

			// middle is the highlighted text
			middle = nodeText.substring( nodeStart, nodeEnd );

			// after is the text in this node after the range
			if ( nodeEnd < nodeText.length ) {
				after = nodeText.substr( nodeEnd );
			}
			else {
				after = null;
			}

			// now update the DOM
			if ( before ) {
				node.nodeValue = before;
			}
			else {
				parent.removeChild( node );
			}

			var span = this.doc.createElement( 'span' );
			span.appendChild( this.doc.createTextNode(middle) );
			parent.insertBefore( span, nextNode );
			r.push( span );

			if ( after ) {
				var newtext = this.doc.createTextNode( after );
				parent.insertBefore( newtext, nextNode );
				// important: make a copy, do not overwrite
				this.chunks[ i ] = { n: newtext, i: nodeEnd };
			}

			i++;

			// if the range doesn't reach the following chunk, we're done
			if ( end <= this.chunks[ i ].o ) {
				break;
			}
		}

		return r;
	}
};
