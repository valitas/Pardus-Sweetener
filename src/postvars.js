{
    let postVars = function () {
        let msg = {
            pardus_sweetener: 1,
            loc: typeof userloc === 'undefined' ? null : userloc,
            ajax: typeof ajax === 'undefined' ? null : ajax,
            navSizeVer: typeof navSizeVer === 'undefined' ? null : navSizeVer,
            navSizeHor: typeof navSizeHor === 'undefined' ? null : navSizeHor,
            fieldsTotal: typeof fieldsTotal === 'undefined' ? null : fieldsTotal,
            tileRes: typeof tileRes === 'undefined' ? null : tileRes
        };
        window.postMessage(msg, document.location.origin);
    }
    if (typeof (addUserFunction) === 'function') {
        addUserFunction(postVars);
    }
    postVars();
}
