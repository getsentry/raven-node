// builtin
var fs = require('fs');
var path = require('path');

// vendor
var stackback = require('stackback');

// fetch modules from environment
var module_cache;
module.exports.getModules = function () {
    if(module_cache) {
        return module_cache;
    }

    module_cache = {};
    require.main.paths.forEach(function(path_dir) {
        if (!fs.existsSync(path_dir)) {
            return;
        }

        var modules = fs.readdirSync(path_dir).filter(function(name) {
            return name.charAt(0) !== '.';
        });

        modules.forEach(function(module) {
            var pkg_json = path.join(path_dir, module, 'package.json');

            try {
                var json = require(pkg_json);
                module_cache[json.name] = json.version;
            } catch(e) {}
        });
    });

    return module_cache;
};

// lines of context around error line
var LINES_OF_CONTEXT = 7;

module.exports.parseStack = function (err, cb) {

    var frames = [];

    // cache file content to avoid re-fetching for context
    var cache = {};

    var callsites = stackback(err);

    var count = 0;
    (function next(err) {
        if (err) {
            return cb(err);
        }

        // done
        if (count >= callsites.length) {
            return cb(null, frames);
        }

        var callsite = callsites[count++];

        var frame = {
            function: callsite.getFunctionName(),
            filename: callsite.getFileName(),
            lineno: callsite.getLineNumber(),
            typename: callsite.getTypeName()
        };

        frames.push(frame);

        var filename = frame.filename;

        // node internals don't look like absolute or relative paths
        if (filename[0] !== '/' && filename[0] !== '.') {
            // node internal
            return next();
        }

        var cached = cache[filename];
        if (cached) {
            parseLines(cached.split('\n'));
            return next();;
        }

        var source = fs.readFile(filename, 'utf8', function(err, source) {
            if (err) {
                return next(err);
            }

            cache[filename] = source;
            parseLines(source.split('\n'));
            return next();
        });

        function parseLines(lines) {
            frame.pre_context = lines.slice(Math.max(0, frame.lineno-(LINES_OF_CONTEXT+1)), frame.lineno-1);
            frame.context_line = lines[frame.lineno-1];
            frame.post_context = lines.slice(frame.lineno, frame.lineno+LINES_OF_CONTEXT);
        }
    })();
};
