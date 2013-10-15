'use strict';

(function( doc ) {

function checkMessageFrame() {
  var f = doc.getElementById( 'msgframe' );
  if ( f ) {
    var src = f.src;
    var reloadNeeded;

    try {
      reloadNeeded = ( f.contentDocument.URL != src );
    }
    catch( e ) {
      // trying to access contentDocument above will cause chrome to
      // give us a security exception if the msgframe failed to load
      // and the frame now contains the error document
      reloadNeeded = true;
    }

    if ( reloadNeeded ) {
      f.src = src;
	}
  }

  // schedule a check in about 1 minute
  doc.defaultView.setTimeout( checkMessageFrame, 59000 );
}

doc.defaultView.setTimeout( checkMessageFrame, 55000 );

})( document );
