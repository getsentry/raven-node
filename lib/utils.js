var raven = require('./client'),
    crypto = require('crypto'),
    fs = require('fs'),
    transports = require('./transports'),
    path = require('path');

module.exports.constructChecksum = function constructChecksum(kwargs) {
    var checksum = crypto.createHash('md5');
    checksum.update(kwargs['message'] || '');
    return checksum.digest('hex');
};

module.exports.getSignature = function getSignature(key, message, timestamp) {
    var hmac = crypto.createHmac('sha1', key);
    hmac.update(timestamp+' '+message);
    return hmac.digest('hex');
};

module.exports.getAuthHeader = function getAuthHeader(signature, timestamp, api_key, project_id) {
    var header = ['Sentry sentry_version=2.0'];
    header.push('sentry_signature='+signature);
    header.push('sentry_timestamp='+timestamp);
    header.push('sentry_client=raven-node/'+raven.version);
    header.push('sentry_key='+api_key);
    header.push('project_id='+project_id);
    return header.join(', ');
};

var module_cache;
module.exports.getModules = function getModules() {
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

var LINES_OF_CONTEXT = 7;

/*
 * Testing out with a custom stack track.
 * (Not done)
 */
module.exports.parseStackBetter = function parseStackBetter(err, cb) {
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    //Error.captureStackTrace(err);
    var lines = err.stack;
    Error.prepareStackTrace = orig;
    
    lines.forEach(function(line, index){
        var frame = {
            function: line.getFunctionName(),
            filename: line.getFileName(),
            lineno: line.getLineNumber(),
            typename: line.getTypeName()
        };
        if(line.getFunctionName() !== 'handle_request1') return;
        console.log(line.getFunction().arguments);
        if(line.fun && line.fun.arguments) {
            frame.args = [];
            for(var i=0, j=line.fun.arguments.length; i<j; i++) {
                frame.args.push(line.fun.arguments[i]);
            }
        }
        console.log(frame);
    });
};

module.exports.parseStack = function parseStack(stack, cb) {
    try {
        // grab all lines except the first
        var lines = stack.split('\n').slice(1),
            callbacks=lines.length,
            frames=[],
            cache={};
        
        if(lines.length === 0) {
            throw new Error('No lines to parse!');
        }

        lines.forEach(function(line, index) {
            var pattern = /^\s*at (?:(.+(?: \[\w\s+\])?) )?\(?(.+?)(?::(\d+):(\d+))?\)?$/,
                data = line.match(pattern).slice(1),
                frame = {
                    filename: data[1],
                    lineno: ~~data[2]
                };

            // only set the function key if it exists
            if(data[0]) {
                frame['function'] = data[0];
            }
            // internal Node files are not full path names. Ignore them.
            if(frame.filename[0] === '/' || frame.filename[0] === '.') {
                // check if it has been read in first
                if(frame.filename in cache) {
                    parseLines(cache[frame.filename]);
                    if(--callbacks === 0) cb(null, frames);
                } else {
                    fs.readFile(frame.filename, function(err, file) {
                        if(!err) {
                            file = file.toString().split('\n');
                            cache[frame.filename] = file;
                            parseLines(file);
                        }
                        frames[index] = frame;
                        if(--callbacks === 0) cb(null, frames);
                    });
                }
            } else {
                frames[index] = frame;
                if(--callbacks === 0) cb(null, frames);
            }

            function parseLines(lines) {
                frame.pre_context = lines.slice(Math.max(0, frame.lineno-(LINES_OF_CONTEXT+1)), frame.lineno-1);
                frame.context_line = lines[frame.lineno-1];
                frame.post_context = lines.slice(frame.lineno, frame.lineno+LINES_OF_CONTEXT);
            }
        });
    } catch(e) {
        cb(new Error('Can\'t parse stack trace:\n' + stack));
    }
};
