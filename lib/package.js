// Generated by CoffeeScript 1.10.0
(function() {
  var Application, CssPackage, Dependency, JsPackage, Package, Stitch, TestPackage, _argv, _hem, create, events, fs, log, path, uglifycss, uglifyjs, utils, versioning,
    slice = [].slice,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  fs = require('fs-extra');

  path = require('path');

  uglifyjs = require('uglify-js');

  uglifycss = require('uglifycss');

  Dependency = require('./dependency');

  Stitch = require('./stitch');

  utils = require('./utils');

  events = require('./events');

  log = require('./log');

  versioning = require('./versioning');

  _hem = void 0;

  _argv = void 0;

  Application = (function() {
    function Application(name, config) {
      var defaults, err, error, key, loadedDefaults, packager, ref, route, value, verType;
      if (config == null) {
        config = {};
      }
      this.name = name;
      this.route = config.route;
      this.root = config.root;
      if (config.defaults) {
        try {
          loadedDefaults = utils.loadAsset('defaults/' + config.defaults);
          defaults = utils.extend({}, loadedDefaults);
        } catch (error) {
          err = error;
          log.error("ERROR: Invalid 'defaults' value provided: " + config.defaults);
          process.exit(1);
        }
        config = utils.extend(defaults, config);
      }
      if (!this.root) {
        if (utils.isDirectory(this.name)) {
          this.root = this.name;
          this.route || (this.route = "/" + this.name);
        } else {
          this.root = "/";
          this.route || (this.route = "/");
        }
      }
      this["static"] = [];
      this.packages = [];
      ref = config["static"];
      for (route in ref) {
        value = ref[route];
        this["static"].push({
          url: this.applyBaseRoute(route),
          path: this.applyRootDir(value)[0]
        });
      }
      for (key in config) {
        value = config[key];
        packager = void 0;
        if (key === 'js' || utils.endsWith(key, '.js')) {
          packager = JsPackage;
          value.name = key;
        } else if (key === 'css' || utils.endsWith(key, '.css')) {
          packager = CssPackage;
          value.name = key;
        }
        if (packager) {
          this.packages.push(new packager(this, value));
        }
      }
      if (config.test) {
        config.test.name = "test";
        this.packages.push(new TestPackage(this, config.test));
      }
      if (config.version) {
        verType = versioning[config.version.type];
        if (!verType) {
          log.errorAndExit("Incorrect type value for version configuration: (" + config.version.type + ")");
        }
        this.versioning = new verType(this, config.version);
      }
    }

    Application.prototype.getTestPackage = function() {
      var i, len, pkg, ref;
      ref = this.packages;
      for (i = 0, len = ref.length; i < len; i++) {
        pkg = ref[i];
        if (pkg.constructor.name === "TestPackage") {
          return pkg;
        }
      }
    };

    Application.prototype.isMatchingRoute = function(route) {
      var i, len, pkg, ref;
      if (this.versioning) {
        route = this.versioning.trim(route);
      }
      ref = this.packages;
      for (i = 0, len = ref.length; i < len; i++) {
        pkg = ref[i];
        if (route === pkg.route.toLowerCase()) {
          return pkg;
        }
      }
    };

    Application.prototype.unlink = function() {
      var i, len, pkg, ref, results1;
      log("Removing application: <green>" + this.name + "</green>");
      ref = this.packages;
      results1 = [];
      for (i = 0, len = ref.length; i < len; i++) {
        pkg = ref[i];
        results1.push(pkg.unlink());
      }
      return results1;
    };

    Application.prototype.build = function() {
      var i, len, pkg, ref, results1;
      log("Building application: <green>" + this.name + "</green>");
      ref = this.packages;
      results1 = [];
      for (i = 0, len = ref.length; i < len; i++) {
        pkg = ref[i];
        results1.push(pkg.build());
      }
      return results1;
    };

    Application.prototype.watch = function() {
      var dirs, pkg;
      log("Watching application: <green>" + this.name + "</green>");
      dirs = (function() {
        var i, len, ref, results1;
        ref = this.packages;
        results1 = [];
        for (i = 0, len = ref.length; i < len; i++) {
          pkg = ref[i];
          results1.push(pkg.watch());
        }
        return results1;
      }).call(this);
      if (dirs.length) {
        return log.info("- Watching directories: <yellow>" + dirs + "</yellow>");
      } else {
        return log.info("- No directories to watch...");
      }
    };

    Application.prototype.version = function() {
      log("Versioning application: <green>" + this.name + "</green>");
      if (this.versioning) {
        return this.versioning.update();
      } else {
        return log.errorAndExit("ERROR: Versioning not enabled in slug.json");
      }
    };

    Application.prototype.applyRootDir = function(value) {
      var values;
      values = utils.toArray(value);
      values = values.map((function(_this) {
        return function(value) {
          if (utils.startsWith(value, "." + path.sep)) {
            return value;
          } else {
            return utils.cleanPath(_this.root, value);
          }
        };
      })(this));
      return values;
    };

    Application.prototype.applyBaseRoute = function() {
      var values;
      values = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (this.route) {
        values.unshift(this.route);
      }
      return utils.cleanRoute.apply(utils, values);
    };

    return Application;

  })();

  Package = (function() {
    function Package(app, config) {
      var i, len, ref, regexp, route, targetFile, targetUrl;
      this.app = app;
      this.name = config.name;
      this.src = this.app.applyRootDir(config.src || "");
      this.target = this.app.applyRootDir(config.target || "")[0];
      if (utils.isDirectory(this.target)) {
        if (this.name === this.ext) {
          targetFile = this.app.name;
        } else {
          targetFile = this.name;
        }
        this.target = utils.cleanPath(this.target, targetFile);
      }
      if (!utils.endsWith(this.target, "." + this.ext)) {
        this.target = this.target + "." + this.ext;
      }
      if (config.route) {
        if (utils.startsWith(this.target, "/")) {
          this.route = config.route;
        } else {
          this.route = this.app.applyBaseRoute(config.route);
        }
      } else {
        ref = this.app["static"];
        for (i = 0, len = ref.length; i < len; i++) {
          route = ref[i];
          if (!this.route) {
            if (utils.startsWith(this.target, route.path)) {
              regexp = new RegExp("^" + (route.path.replace(/\\/g, "\\\\")) + "(\\\\|\/)?");
              targetUrl = this.target.replace(regexp, "");
              this.route = utils.cleanRoute(route.url, targetUrl);
            }
          }
        }
      }
      if (_argv.command === "server" && !this.route) {
        log.errorAndExit("Unable to determine route for <yellow>" + this.target + "</yellow>");
      }
    }

    Package.prototype.handleCompileError = function(ex) {
      if (_hem.handleCompileError) {
        _hem.handleCompileError(ex);
        return;
      }
      log.error(ex.message);
      if (ex.path) {
        log.error(ex.path);
      }
      switch (_argv.command) {
        case "server":
          if (this.ext === "js") {
            return "alert(\"HEM: " + ex + "\\n\\n" + ex.path + "\");";
          } else {
            return "";
          }
          break;
        case "watch":
          return "";
        default:
          return process.exit(1);
      }
    };

    Package.prototype.unlink = function() {
      if (fs.existsSync(this.target)) {
        log.info("- removing <yellow>" + this.target + "</yellow>");
        return fs.unlinkSync(this.target);
      }
    };

    Package.prototype.build = function(file) {
      var dirname, extra, source, write;
      if (file) {
        Stitch.clear(file);
      }
      extra = (_argv.compress && " <b>--using compression</b>") || "";
      log.info("- Building target: <yellow>" + this.target + "</yellow>" + extra);
      source = this.compile();
      write = _argv.command !== "server";
      if (source && write) {
        dirname = path.dirname(this.target);
        if (!fs.existsSync(dirname)) {
          fs.mkdirsSync(dirname);
        }
        fs.writeFileSync(this.target, source);
      }
      return source;
    };

    Package.prototype.watch = function() {
      var dir, dirs, fileOrDir, i, j, len, len1, ref, watchOptions;
      watchOptions = {
        persistent: true,
        interval: 1000,
        ignoreDotFiles: true,
        maxListeners: 128
      };
      dirs = [];
      ref = this.getWatchedDirs();
      for (i = 0, len = ref.length; i < len; i++) {
        fileOrDir = ref[i];
        if (!fs.existsSync(fileOrDir)) {
          continue;
        }
        if (utils.isDirectory(fileOrDir)) {
          dirs.push(fileOrDir);
        } else {
          dirs.push(path.dirname(fileOrDir));
        }
      }
      dirs = utils.removeDuplicateValues(dirs);
      for (j = 0, len1 = dirs.length; j < len1; j++) {
        dir = dirs[j];
        require('watch').watchTree(dir, watchOptions, (function(_this) {
          return function(file, curr, prev) {
            if (curr && (curr.nlink === 0 || +curr.mtime !== +(prev != null ? prev.mtime : void 0))) {
              _this.build(file);
              return events.emit("watch", _this.app, _this, file);
            }
          };
        })(this));
      }
      return dirs;
    };

    Package.prototype.getWatchedDirs = function() {
      return this.src;
    };

    Package.prototype.ext = "";

    return Package;

  })();

  JsPackage = (function(superClass) {
    extend(JsPackage, superClass);

    function JsPackage(app, config) {
      JsPackage.__super__.constructor.call(this, app, config);
      this.commonjs = config.commonjs || 'require';
      this.libs = this.app.applyRootDir(config.libs || []);
      this.modules = utils.toArray(config.modules || []);
      this.before = utils.arrayToString(config.before || "");
      this.after = utils.arrayToString(config.after || "");
    }

    JsPackage.prototype.compile = function() {
      var error, ex, result;
      try {
        result = [this.before, this.compileLibs(), this.compileModules(), this.after].join("\n");
        if (_argv.compress) {
          result = uglifyjs.minify(result, {
            fromString: true
          }).code;
        }
        return result;
      } catch (error) {
        ex = error;
        return this.handleCompileError(ex);
      }
    };

    JsPackage.prototype.compileModules = function() {
      var _modules;
      this.depend || (this.depend = new Dependency(this.modules));
      this.stitch || (this.stitch = new Stitch(this.src));
      _modules = this.depend.resolve().concat(this.stitch.resolve());
      if (_modules) {
        return Stitch.template(this.commonjs, _modules);
      } else {
        return "";
      }
    };

    JsPackage.prototype.compileLibs = function(files, parentDir) {
      var dir, file, i, len, ref, results, slash, stats;
      if (files == null) {
        files = this.libs;
      }
      if (parentDir == null) {
        parentDir = "";
      }
      results = [];
      for (i = 0, len = files.length; i < len; i++) {
        file = files[i];
        if (utils.endsWith(file, ";")) {
          results.join(file);
        } else {
          slash = parentDir === "" ? "" : path.sep;
          if (file.startsWith("_")) {
            continue;
          }
          file = parentDir + slash + file;
          if (fs.existsSync(file)) {
            stats = fs.lstatSync(file);
            if (stats.isDirectory()) {
              dir = fs.readdirSync(file);
              results.push(this.compileLibs(dir, file));
            } else if (stats.isFile() && ((ref = path.extname(file)) === '.js' || ref === '.coffee')) {
              results.push(fs.readFileSync(file, 'utf8'));
            }
          }
        }
      }
      return results.join("\n");
    };

    JsPackage.prototype.getWatchedDirs = function() {
      return this.src.concat(this.libs);
    };

    JsPackage.prototype.ext = "js";

    return JsPackage;

  })(Package);

  TestPackage = (function(superClass) {
    extend(TestPackage, superClass);

    function TestPackage(app, config) {
      var ref;
      TestPackage.__super__.constructor.call(this, app, config);
      this.depends = utils.toArray(config.depends);
      this.testHome = path.dirname(this.target);
      this.framework = _hem.options.hem.test.frameworks;
      if ((ref = this.framework) !== 'jasmine' && ref !== 'mocha') {
        log.errorAndExit("Test frameworks value is not valid: " + this.framework);
      }
      this.after += "// HEM: load in specs from test js file\nvar onlyMatchingModules = \"" + (_argv.grep || "") + "\";\nfor (var key in " + this.commonjs + ".modules) {\n  if (onlyMatchingModules && key.indexOf(onlyMatchingModules) == -1) {\n    continue;\n  }\n  " + this.commonjs + "(key);\n}";
    }

    TestPackage.prototype.build = function(file) {
      this.createTestFiles();
      return TestPackage.__super__.build.call(this, file);
    };

    TestPackage.prototype.getAllTestTargets = function(relative) {
      var dep, depapp, homeRoute, i, j, k, l, len, len1, len2, len3, pkg, pth, ref, ref1, ref2, ref3, relativeFn, targets, url;
      if (relative == null) {
        relative = true;
      }
      targets = [];
      homeRoute = path.dirname(this.route);
      relativeFn = function(home, target, url) {
        var value;
        if (url == null) {
          url = true;
        }
        value = "";
        if (relative) {
          value = path.relative(home, target);
        } else {
          value = target;
        }
        if (url) {
          return value.replace(/\\/g, "/");
        } else {
          return value;
        }
      };
      ref = this.depends;
      for (i = 0, len = ref.length; i < len; i++) {
        dep = ref[i];
        ref1 = _hem.allApps;
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          depapp = ref1[j];
          if (depapp.name === dep) {
            ref2 = depapp.packages;
            for (k = 0, len2 = ref2.length; k < len2; k++) {
              pkg = ref2[k];
              if (pkg.constructor.name !== "JsPackage") {
                continue;
              }
              url = relativeFn(homeRoute, pkg.route);
              pth = relativeFn(this.testHome, pkg.target);
              targets.push({
                url: url,
                path: pth
              });
            }
          }
        }
      }
      ref3 = this.app.packages;
      for (l = 0, len3 = ref3.length; l < len3; l++) {
        pkg = ref3[l];
        if (pkg.constructor.name !== "JsPackage") {
          continue;
        }
        url = relativeFn(homeRoute, pkg.route);
        pth = relativeFn(this.testHome, pkg.target);
        targets.push({
          url: url,
          path: pth
        });
      }
      url = relativeFn(homeRoute, pkg.route);
      pth = relativeFn(this.testHome, pkg.target);
      targets.push({
        url: url,
        path: pth
      });
      return targets;
    };

    TestPackage.prototype.getFrameworkFiles = function() {
      var file, frameworkPath, i, len, ref, ref1, targets, url;
      targets = [];
      frameworkPath = path.resolve(__dirname, "../assets/testing/" + this.framework);
      ref = fs.readdirSync(frameworkPath);
      for (i = 0, len = ref.length; i < len; i++) {
        file = ref[i];
        if ((ref1 = path.extname(file)) === ".js" || ref1 === ".css") {
          url = this.framework + "/" + file;
          targets.push({
            url: url,
            path: url
          });
        }
      }
      return targets;
    };

    TestPackage.prototype.getTestIndexFile = function() {
      return path.resolve(this.testHome, 'index.html');
    };

    TestPackage.prototype.createTestFiles = function() {
      var file, filepath, files, frameworkPath, i, indexFile, len, ref, ref1, results1, template;
      indexFile = this.getTestIndexFile();
      if (!fs.existsSync(indexFile)) {
        files = [];
        files.push.apply(files, this.getFrameworkFiles());
        files.push.apply(files, this.getAllTestTargets());
        template = utils.tmpl("testing/index", {
          commonjs: this.commonjs,
          files: files,
          before: this.before
        });
        fs.outputFileSync(indexFile, template);
        frameworkPath = path.resolve(__dirname, "../assets/testing/" + this.framework);
        ref = fs.readdirSync(frameworkPath);
        results1 = [];
        for (i = 0, len = ref.length; i < len; i++) {
          file = ref[i];
          if ((ref1 = path.extname(file)) === ".js" || ref1 === ".css") {
            filepath = path.resolve(this.testHome, this.framework + "/" + file);
            results1.push(utils.copyFile(path.resolve(frameworkPath, file), filepath));
          } else {
            results1.push(void 0);
          }
        }
        return results1;
      }
    };

    return TestPackage;

  })(JsPackage);

  CssPackage = (function(superClass) {
    extend(CssPackage, superClass);

    function CssPackage(app, config) {
      CssPackage.__super__.constructor.call(this, app, config);
    }

    CssPackage.prototype.compile = function() {
      var error, ex, file, fileOrDir, i, j, len, len1, output, ref, ref1, requireCss, result;
      try {
        output = [];
        requireCss = function(filepath) {
          filepath = require.resolve(path.resolve(filepath));
          delete require.cache[filepath];
          return require(filepath);
        };
        ref = this.src;
        for (i = 0, len = ref.length; i < len; i++) {
          fileOrDir = ref[i];
          if (utils.isDirectory(fileOrDir)) {
            ref1 = fs.readdirSync(fileOrDir);
            for (j = 0, len1 = ref1.length; j < len1; j++) {
              file = ref1[j];
              if (!require.extensions[path.extname(file)]) {
                continue;
              }
              file = path.resolve(fileOrDir, file);
              output.push(requireCss(file));
            }
          } else {
            output.push(requireCss(fileOrDir));
          }
        }
        result = output.join("\n");
        if (_argv.compress) {
          result = uglifycss.processString(result);
        }
        return result;
      } catch (error) {
        ex = error;
        return this.handleCompileError(ex);
      }
    };

    CssPackage.prototype.ext = "css";

    return CssPackage;

  })(Package);

  create = function(name, config, hem, argv) {
    _hem || (_hem = hem);
    _argv || (_argv = argv);
    return new Application(name, config);
  };

  module.exports.create = create;

}).call(this);
