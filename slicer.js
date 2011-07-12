// This is a rather clever hack based on Raymond Hill's "HTML text
// hilighter" (http://www.raymondhill.net/blog/?p=272).
//
// We need to work on fragments of text in a document.  We want to
// highlight them, or set event listeners and wotnot.  Problem is,
// these text fragments may span across elements in the document, so
// we won't have a single node to work with.  Instead, each text
// fragment will be split in a sequence of nodes, inserted as children
// of the original nodes that contain pieces of the text.
//
// The class below does this processing.  Upon creation, it scans the
// tree from the designated root downwards and constructs a single
// string that can be accessed in the member variable 'text'.  This
// string can be used to obtain ranges (via matching regular
// expressions or whatever), which can then be passed to the method
// slice(), which will modify the document, adding span elements as
// appropriate, and return the array of spans enclosing the parts of
// the range.

function TreeSlicer(root) {
  this.root = root;
  this.doc = root.ownerDocument;
  this.text = new Array(); // will be joined into a single string after the scan
  this.textLength = 0;
  this.chunks = new Array();

  this.scanForText(root);

  this.text = this.text.join('');
  this.chunks.push({ o: this.text.length }); // sentinel
}

// XXX - these should be customisable, we may not always want to skip these
TreeSlicer.prototype.HTML_IGNORE = {
  style: true, script: true, form: true
};
TreeSlicer.prototype.HTML_BLOCK = {
  address: true, blockquote: true, br: true, center: true, div: true,
  dir: true, frameset: true, h1: true, h2: true, h3: true, h4: true,
  h5: true, h6: true, hr: true, isindex: true, noframes: true,
  noscript: true, p: true, pre: true, table: true, form: true
};

// The following method is not intended to be a part of the public
// interface. It's used by the constructor to recurse into the DOM
// tree, extracting text.  At the end of the recursion, context.chunks
// contains each text node found and the offset into the text at which
// it occurs.

TreeSlicer.prototype.scanForText = function(node) {
  switch(node.nodeType) {
  case 3:
    // a text node; collect it
    var text = node.nodeValue;
    if(text.length > 0) {
      this.text.push(text);
      this.chunks.push({ o: this.textLength, n: node });
      this.textLength += text.length;
    }
    // else ignore empty texts (can this even happen?)
    break;

  case 1:
    // an element node.
    // * if script or style, ignore; else recurse into children.
    // * if block element (address, blockquote, center, div, dir,
    //   frameset, h1, h2, h3, h4, h5, h6, hr, isindex, noframes,
    //   noscript, p, pre, table, form) or br, append a linefeed to the
    //   text.
    var tag = node.tagName.toLowerCase();
    if(!this.HTML_IGNORE[tag]) {
      var children = node.childNodes;
      for(var i = 0; i < children.length; i++)
        this.scanForText(children[i]);
      if(this.HTML_BLOCK[tag] && this.text.length > 0) {
        this.text[this.text.length-1] += "\n";
        this.textLength++;
      }
    }
  }
};

// This is the method we want to use to "slice" a text fragment.
//
// Parameters 'start' and 'end' are offsets into this.text.  The text
// fragment includes the character at this.text[start], and runs up
// to, but not including, the character at this.text[end].  The method
// will identify all document nodes containing parts of the text, and
// modify the tree so that each part is enclosed in a span element
// (which may, and usually does mean splitting text nodes).
//
// IMPORTANT: You may call this method repeatedly, but the ranges in
// each call should be at increasing offsets and must not overlap with
// ranges used in previous calls.
//
// The method returns an array of nodes. Each node is a span element,
// and the whole set comprise the text you want.  You may set all
// these spans to some class, or assign a style, or event listeners or
// whatever.

TreeSlicer.prototype.slice = function(start, end) {
  var r = new Array();

  if(start < 0)
    start = 0;
  if(end > this.text.length)
    end = this.text.length;

  if(end <= start + 1)
    return r;

  // Find the entry in this.chunks which contains the first character
  // in the range, using Raymond's elegant binary search.
  var a = 0, b = this.chunks.length;
  while(a < b) {
    var i = a + b >> 1;
    if(start < this.chunks[i].o)
      b = i;
    else if(start >= this.chunks[i+1].o)
      a = i+1;
    else
      a = b = i;
  }

  // Now, for every entry in this.chunks which intersects with the
  // text fragment, extract the intersecting text and put it into a
  // span.
  while(i < this.chunks.length) {
    var entry = this.chunks[i];
    var node = entry.n;
    var parent = node.parentNode;
    var nextNode = node.nextSibling;
    var nodeText = node.nodeValue;
    var nodeStart = start - entry.o;
    var nodeEnd = Math.min(end, this.chunks[i+1].o) - entry.o;

    var before, middle, after;

    // before is the text in this node before the range
    if(nodeStart > 0)
      before = nodeText.substring(0, nodeStart);
    else
      before = null;
    // middle is the highlighted text
    middle = nodeText.substring(nodeStart, nodeEnd);
    // after is the text in this node after the range
    if(nodeEnd < nodeText.length)
      after = nodeText.substr(nodeEnd);
    else
      after = null;

    // now update the DOM
    if(before)
      node.nodeValue = before;
    else
      parent.removeChild(node);
    var span = this.doc.createElement('span');
    span.appendChild(this.doc.createTextNode(middle));
    parent.insertBefore(span, nextNode);
    r.push(span);
    if(after) {
      var newtext = this.doc.createTextNode(after);
      parent.insertBefore(newtext, nextNode);
      this.chunks[i] = { n: newtext, i: nodeEnd }; // important: make a copy, do not overwrite
    }

    i++;

    // if the range doesn't reach the following chunk, we're done
    if(end <= this.chunks[i].o)
      break;
  }

  return r;
};
