class W_Generic  {
    constructor (element) {
        this.element = element;
        let self = this;
        
        this.proxy = new Proxy (element, {
            get (...args) {
                return self.demand(...args);
            },
            
            set (target, property, value) {
                if (typeof property == "undefined") throw new Error("Undefined is not a valid property name on " + this.constructor.name + ":=" + value);
                if (typeof property == "number" && isNaN(property)) throw new Error("NaN is not a valid property name on " + this.constructor.name + ":=" + value);
                if (typeof value == "undefined") throw new Error("Undefined is not a value on " + this.constructor.name + ":" + property);
                if (typeof value == "number" && isNaN(value)) throw new Error("NaN is not a value on " + this.constructor.name + ":" + property);
                
                target[property] = value;
                return true;
            }
        });
    }
    
    log () {
        if (Array.isArray(this.element))
            console.log(this.element.map(item => item.raw));
        else
            console.log(this.element);
    }
    
    demand (target, property, receiver) {
        if (typeof this[property] != "undefined")
            return this[property];
        else if (typeof target[property] != "undefined")
            if (typeof target[property] == "function")
                return target[property].bind(target);
            else
                return target[property];
        
        if (property == Symbol.toPrimitive || property == Symbol.toStringTag) { return this.element.toString; } //throw new Error("Primitive conversion in " + this.constructor.name + ". Did you mean to write .raw?");
        if (property == "toJSON") { return this.element.toString; }
        
        throw new Error("Element lacks specified property in " + this.constructor.name + ":" + property.toString());
    }
}

class W_SinExt extends W_Generic {
    constructor (element, receivedBy) {
        super(element);
        this.receivedBy = receivedBy;
    }
    
    get raw () {
        return this.element;
    }
    
    get stamp () {
        return this.constructor;
    }
    
    get index () {
        return [...this.element.parentElement.children].indexOf(this.element);
    }
    
    get next () {
        return Q(this.element.nextElementSibling);
    }
    
    get child () {
        return Q(this.element.firstElementChild);
    }
    
    get children () {
        return Q(this.element.children);
    }
    
    /* altering */
    
    on (type, callback) { if (!callback) throw Error ("Callback cannot be null. Of type: " + type); this.element.addEventListener(type, (...args) => callback.call(this, ...args)); return this.proxy; }
    content (value) { this.element.innerHTML = value; return this.proxy; }
    class (_class, positive = true) { positive ? this.element.classList.add(_class) : this.element.classList.remove(_class); return this.proxy; }
    hasClass (_class) { return this.element.classList.contains(_class); }
    
    append (child) {
        if (!child)
            throw new Error("Cannot append undefined");
        
        if (child.stamp && child.stamp.name == "W_SinExt")
            this.element.append(child.raw);
        else
            this.element.append(child);
    }
    
    prepend (child) {
        if (!child)
            throw new Error("Cannot prepend undefined");
        
        if (child.stamp && child.stamp.name == "W_SinExt")
            this.element.prepend(child.raw);
        else
            this.element.prepend(child);
    }
    
    replaceWith (child) {
        if (!child)
            throw new Error("Cannot replaceWith undefined");
        
        if (child.stamp && child.stamp.name == "W_SinExt")
            this.element.replaceWith(child.raw);
        else
            this.element.replaceWith(child);
    }
    
    /* creational */
    
    to (css, m) { return Q(css, m, this.element, this.receivedBy); }
    near (selector, m) { let a = Q(this.element.parentElement).to(selector, true); return m ? a.filter(item => item.raw != this.raw) : a.find(item => item.raw != this.raw); }
    
    from (selector) {
        if (this.element.parentElement == null) throw new Error("Parent list does not include element(s) matching provided selector: " + selector);
        let parent = Q(this.element.parentElement);
        
        if (parent.matches(selector) || !selector)
            return parent;
        else
            return parent.from(selector);
    }
}

class W_ListExt extends W_Generic {
    constructor (list) {
        super(list);
        this.list = list;
    }
    
    get style () {
        let self = this;
        
        return new Proxy({}, {
            get () {
                throw new Error("This does not quite make sense");
            },
            
            set (_, prop, value) {
                self.list.forEach(element => element.style[prop] = value);
                return true;
            }
        });
    }
    
    /* altering */
    
    on (...args) { this.list.forEach(element => element.on(...args)); return this.proxy; }
    remove () { this.list.forEach(element => element.remove()); return this.proxy; }
    content (value) { this.list.forEach(element => element.content(value)); return this.proxy; }
    
    /* creational */
    
    to (selector) { return new W_ListExt(this.list.map(element => element.to(selector))); }
    near (selector) { return new W_ListExt(this.list.map(element => element.near(selector))); } 
    child () { return new W_ListExt(this.list.map(element => element.child())); }
    from (selector) { return new W_ListExt(this.list.map(element => element.from(selector))); }
}


function Q (input, m, parent = document, parentClass = "") {
    let source = null;
    let query = "";
    
    if (input instanceof HTMLElement || input instanceof SVGElement || Array.isArray(input)) {
        source = input;
    } else if (input instanceof HTMLCollection) {
        source = [...input];
    } else if (typeof input == "string") {
        if (input.includes("&") && !parentClass) throw new Error("Invalid parent alias: element is the first in the chain or was created from raw");
        query = input.replace("&", parentClass);
        source = m ? [...parent.querySelectorAll(query)] : parent.querySelector(query);
    } else if (input === undefined) {
        source = document.body;
    } else {
        throw new Error("Source element type not supported: \"" + input + "\"");
    }
    
    if (!source) return null;
    
    let wrapper;
    
    if (Array.isArray(source))
        wrapper = new W_ListExt(source.map(item => (new W_SinExt(item, input.toString())).proxy));
    else
        wrapper = new W_SinExt(source, query);
    
    return wrapper.proxy;
}

function Q_template (input, options) {
    if (!input) throw new Error("Input cannot be null");
    let target = input;
    
    if (typeof input == "string" && isSelectorValid(input)) {
        target = Q(input);
        if (!target)
            throw new Error("Templates found by the selector: none");
    }
    if (target.stamp == W_SinExt)
        target = target.raw;
    if (target instanceof HTMLElement)
        target = target.innerHTML;
    
    for (let option in options)
        target = target.replace(new RegExp(`{ ${option} }`, "g"), options[option]);
    
    let tmp = document.createElement("div");
    tmp.innerHTML = target;
    
    return Q(tmp.firstElementChild);
}

function isSelectorValid (selector) {
    try { document.createDocumentFragment().querySelector(selector) } catch(err) { return false; } return true;
}

export default new class extends Function {
    constructor () {
        super("...args", "return this.search(...args);");
        return this.bind(this);
    }
    
    search (...args) { return Q(...args); }
    tmplt (...args) { return Q_template(...args); }
}();
