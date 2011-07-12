// Universe detection

// 'artemis', 'orion', 'pegasus'
function detectUniverse(doc) {
  if(!doc)
    doc = document;
  var m = /^([^.]+)\.pardus\.at$/.exec(doc.location.host);
  if(m)
    return m[1];
  return null;
}

// 'Artemis', 'Orion', 'Pegasus'
function universeName(doc) {
  var universe = detectUniverse(doc);
  return universe.substr(0,1).toUpperCase() + universe.substr(1);
}
