// Universe detection

var Universe = (function() {

function getServer( doc ) {
	var match;

	match = /^([^.]+)\.pardus\.at$/.exec( doc.location.hostname );
	if ( match ) {
		return match[ 1 ];
	}

	return null;
}

return {
	// 'artemis', 'orion', 'pegasus'
	getServer: getServer,

	// 'Artemis', 'Orion', 'Pegasus'
	getName: function( doc ) {
		var server = getServer( doc );
		return server.substr( 0, 1 ).toUpperCase() + server.substr( 1 );
	}
};

})();
