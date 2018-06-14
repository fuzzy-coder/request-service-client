const DRIVERS = require('./drivers');
const _ = require('lodash');

class ServiceClient{
    constructor(config = {}){
        let moduleBuilder = new ModuleBuilder(config)
        _.assign(this, moduleBuilder.build())
    }

    _validateOptions(options = {}){
        if(!options.uri){
            throw new Error("IMPLEMENTATION ERROR :: please provide uri")
        }
        if(this.cache.config.isEnabled && !this.cache.config.expiry && !options.cache_expiry){
            throw new Error("IMPLEMENTATION ERROR :: either provide cache.expiry when initializing service client or pass cache_expiry method options")
        }
    }

    _generateCacheKeyFromOptions(options = {}){
        return options.uri
    }

    async call(method, options = {}){
        this._validateOptions(options)
        if(this.cache.config.isEnabled){
            let key = this._generateCacheKeyFromOptions(options)
            let {data, isCached} = this.cache.driver.get(key)
            if(!isCached){
                let transformer = options.transformer
                options.transformer = (response)=> {
                    this.cache.driver.set(key, response, options.cache_expiry || null)
                    return transformer(response)
                }
                return this.http.driver[method](options)
            }else{
                return data
            }
        }
    }

    async get(options = {}){
        return this.call('get', options)
    }

    async post(options = {}){
        return this.call('post', options)
    }

    async put(options = {}){
        return this.call('put', options)
    }

    async patch(options = {}){
        return this.call('patch', options)
    }

    async delete(options = {}){
        return this.call('delete', options)
    }
}

class ModuleBuilder{
    constructor(config={}){
        this.config = config
    }

    build(){
        let modules = { http: null, cache: null, logger: null };

        module.cache = this.buildCacheDriver()

        module.http = this.buildHttpDriver()

        module.logger = this.buildLoggingDriver()
        
        return modules;
    }

    buildCacheDriver(){
        let module = { driver: null, config: {expiry: null, isEnabled: false} };
        if(this.config.cache){
            let cache = this.config.cache
            if(cache.methods){
                let methods = cache.methods
                
                if(!methods.set){
                    throw new Error('IMPLEMENTATION ERROR :: cache methods object should contain set method eg >> set(key, value, expiry)')
                }

                if(!methods.set){
                    throw new Error('IMPLEMENTATION ERROR :: cache methods object should contain set method eg >> get(key)')
                }

                let driver = new DRIVERS.CacheClientDriver()
                driver.set = methods.set.bind(driver)
                driver.get = methods.get.bind(driver)

                module.driver = driver
                module.config.isEnabled = true
            } else if (this.config.cache.uri){
                let driver = new DRIVERS.CacheClientDriver({uri: this.config.cache.uri, expiry: this.config.cache.expiry || null})
                module.driver = driver
                module.config.isEnabled = true
                module.config.expiry = this.config.cache.expiry || null
            } else if (!this.config.cache.uri){
                throw new Error('IMPLEMENTATION ERROR :: Either use methods to provide custom caching implementation or provide cache service uri')
            }
        }
        return module;
    }

    buildHttpDriver(){
        return {
            driver: new DRIVERS.HTTPClientDriver(),
            config: {}
        }
    }

    buildLoggingDriver(){
        let module = {driver: null, config: {}}

        if(this.config.logger && this.config.logger.methods){
            let logger = this.config.logger
            let methods = logger.methods

            if(!methods.info){
                throw new Error('IMPLEMENTATION ERROR :: logger methods object should contain info method eg >> info(request, response)')
            }

            if(!methods.error){
                throw new Error('IMPLEMENTATION ERROR :: logger methods object should contain error method eg >> error(request, response)')
            }

            let driver = new DRIVERS.CacheClientDriver()
            driver.info = methods.info.bind(driver)
            driver.error = methods.error.bind(driver)

            module.driver = driver
        }else{
            module.driver = new DRIVERS.RequestLoggingDriver()
        }
        
        return module
    }
}

module.exports = ServiceClient