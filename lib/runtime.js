// builtin
var fs = require('fs');
var path = require('path');

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

