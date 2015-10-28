"use strict";

var DisplayTree = undefined;
JsDbg.OnLoad(function() {
    // Add a type description for CDispNode to link to the DisplayTree.
    DbgObject.AddTypeDescription(MSHTML.Module, "CDispNode", function(dispNode) {
        if (dispNode.isNull()) {
            return "null";
        } else {
            return "<a href=\"/displaytree/#" + dispNode.ptr() + "\">" + dispNode.ptr() + "</a>";
        }
    });

    if (JsDbg.GetCurrentExtension() == "displaytree") {
        DbgObjectTree.AddRoot("Display Tree", function() {
            return MSHTML.GetCDocs()
            .then(function(docs) {
                return Promise.map(docs, function(doc) { return doc.f("_view._pDispRoot"); });
            })
            .then(function(dispRoots) {
                return Promise.filter(Promise.join(dispRoots), function(dispRoot) { return !dispRoot.isNull(); })
            })
            .then(function(nonNullDispRoots) {
                if (nonNullDispRoots.length == 0) {
                    return Promise.fail();
                }
                return nonNullDispRoots;
            })
            .then(null, function(error) {
                var errorMessage =
                    "No CDispRoots were found.\
                    Possible reasons:\
                    <ul>\
                        <li>The debuggee is not IE 11 or Edge.</li>\
                        <li>No page is loaded.</li>\
                        <li>The debugger is in 64-bit mode on a WoW64 process (\".effmach x86\" will fix).</li>\
                        <li>Symbols aren't available.</li>\
                    </ul>\
                    Refresh the page to try again, or specify a CDispNode explicitly.";

                if (error) {
                    errorMessage = "<h4>" + error.toString() + "</h4>" + errorMessage;
                }
                return Promise.fail(errorMessage);
            });
        });

        DbgObjectTree.AddAddressInterpreter(function (address) {
            return new DbgObject(MSHTML.Module, "CDispNode", address).vcast();
        });

        DbgObjectTree.AddType(null, MSHTML.Module, "CDispParentNode", null, function (object) {
            return object.f("_pFirstChild").latestPatch().list(function (node) {
                return node.f("_pNext").latestPatch()
            }).vcast();
        });
    }

    var builtInFields = [
        {
            fullType: {
                module: MSHTML.Module,
                type: "CDispNode"
            },
            fullname: "Bounds",
            shortname: "b",
            async:true,
            html: function() {
                var rect = this.f("_rctBounds");
                return Promise.map(["left", "top", "right", "bottom"], function(f) { return rect.f(f).val(); })
                    .then(function(values) { return values.join(" "); });
            }
        },
        {
            fullType: {
                module: MSHTML.Module,
                type: "CDispNode"
            },
            fullname: "Client",
            shortname: "c",
            async:true,
            html: function() {
                // Get the latest patch...
                return this.latestPatch()

                // Check if it has advanced display...
                .then(function(node) {
                    return node.f("_flags._fAdvanced").val()

                    // And get the disp client.
                    .then(function(hasAdvanced) {
                        if (hasAdvanced) {
                            return node.f("_pAdvancedDisplay._pDispClient").vcast();
                        } else {
                            return node.f("_pDispClient").vcast();
                        }
                    });
                });
            }
        },
        {
            fullType: {
                module: MSHTML.Module,
                type: "CDispNode"
            },
            fullname: "All Flags",
            shortname: "flags",
            async:true,
            html: function() {
                return Promise
                    .filter(this.f("_flags").fields(), function(f) {
                        if (f.name.indexOf("_fUnused") != 0 && f.value.bitcount == 1) {
                            return f.value.val();
                        } else {
                            return false;
                        }
                    })
                    .then(function(flags) {
                        return flags
                            .map(function(flag) { return flag.name; })
                            .join(" ");
                    });
            }
        }
    ];

    DisplayTree = {
        Name: "DisplayTree",
        BasicType: "CDispNode",
        DefaultFieldType: {
            module: MSHTML.Module,
            type: "CDispNode"
        },
        BuiltInFields: builtInFields
    };
});
