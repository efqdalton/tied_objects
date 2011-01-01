/*! TiedObjects
*
* A lightweight and very simple JavaScript library that helps
* to build web applications using WebSockets
*
* Author: Dalton Pinto
* Email: dalthon at aluno dot ita dot br
* Copyright: Dalton Pinto - 2011
*
* License: MIT
*
*/

var TiedObject        = Class.create();
var SourceObject      = Class.create();
var WebSocketTie      = Class.create();
var TieStaticTemplate = Class.create();

SourceObject.indexed_sources = {};
Tie = function(object_id){
  return SourceObject.indexed_sources[object_id];
};

SourceObject.find_or_create = function(object_id){
  var source = Tie(object_id);
  if(source == undefined){
    source = new SourceObject(object_id);
  }
  return source;
};

SourceObject.prototype = {
  initialize: function(object_id){
    this.object_id       = object_id;
    this.tied_attributes = {};
    SourceObject.indexed_sources[object_id] = this;
  },

  update_attribute: function(attribute, value){
    this.tied_attributes[attribute] = value;
    this.notify(attribute);
  },

  update_attributes: function(hash){
    var that = this;
    $H(hash).each(function(pair){
      that.update_attribute(pair.key, pair.value);
    });
  },

  notify: function(attribute){
    Event.fire(document, 'tied:'+this.object_id+':'+attribute, { tied_attribute: this.tied_attributes[attribute] });
  }
}

TiedObject.types = {tied_object: TiedObject}
TiedObject.add_type = function(type, klass){
  TiedObject.types[type] = klass;
};

TieStaticTemplate.templates = {};
TieStaticTemplate.find = function(path){
  return TieStaticTemplate.templates[path] || new TieStaticTemplate(path);
}

TieStaticTemplate.prototype = {
  initialize: function(path){
    this.path = path;
    this.loading = false;
    TieStaticTemplate.templates[path] = this;
  },

  load_template: function(){
    this.loading = true;
    var that = this;
    new Ajax.Request(this.path, {
      method: 'get',

      onSuccess: function(transport){
        that.template = new Template(transport.responseText || "");
        that.loading = false;
        document.fire('tied:template_load:'+that.path);
      },

      onComplete: function(transport){
        that.loading = false;
      }
    });
  },

  get: function(callback){
    if( this.loading == false && this.template != null){
      callback(this.template);
    }else{
      if( this.loading == false ) this.load_template();
      var that = this;
      var event_callback = function(event){
        callback(that.template);
        document.stopObserving('tied:template_load:'+that.path, event_callback);
      };
      document.observe('tied:template_load:'+this.path, event_callback);
    }
  }
}

TiedObject.tie_all = function(){
  $$('[tied_object]').each(function(tied_object){
    object_id = tied_object.readAttribute('tied_object');
    tie_type  = tied_object.readAttribute('tie_type') || 'tied_object';
    tied_object.removeAttribute('tie_type');
    new TiedObject.types[tie_type](tied_object).subscribe();
  });
};

TiedObject.subclass_it = function(class_name, definitions){
  var new_class = Class.create();
  new_class.prototype = Object.extend(new TiedObject(), definitions);
  TiedObject.add_type(class_name, new_class);
  return new_class;
};

TiedObject.prototype = {
  initialize: function(tied_object, object_id, tied_attribute, tied_on){
    if(tied_object == null) return ;
    this.tied_object    = tied_object;
    this.object_id      = object_id      || tied_object.readAttribute('tied_object');
    this.tied_attribute = tied_attribute || tied_object.readAttribute('tied_attribute');
    this.tied_on        = tied_on        || tied_object.readAttribute('tied_on');
    tied_object.removeAttribute('tied_object');
    tied_object.removeAttribute('tied_attribute');
    tied_object.removeAttribute('tied_on');
  },

  load_static_template: function(path){
    var that = this;
    TieStaticTemplate.find(path).get(function(template){
      that.template = template;
    });
  },

  subscribe: function(){
    var that = this;
    SourceObject.find_or_create(this.object_id);
    document.observe('tied:'+this.object_id+':'+this.tied_attribute, function(event){
      that.update_object(event.memo.tied_attribute);
    });
  },

  refresh: function(){
    var source_object = SourceObject.find_or_create(this.object_id);
    this.update_object(source_object.tied_attributes[this.tied_attribute]);
  },

  update_object: function(value){
    if(this.tied_on == 'inner_text'){
      this.tied_object.update(value);
    }else{
      this.tied_object.setAttribute(this.tied_on, value);
    }
  }
};

var TiedTemplate = TiedObject.subclass_it('tied_template', {
  initialize: function(tied_object, object_id, tied_attribute, tied_template){
    this.tied_object    = tied_object;
    this.object_id      = object_id      || tied_object.readAttribute('tied_object');
    this.tied_attribute = tied_attribute || tied_object.readAttribute('tied_attribute');
    this.load_static_template( tied_template || tied_object.readAttribute('tied_template') );
    tied_object.removeAttribute('tied_object');
    tied_object.removeAttribute('tied_attribute');
    tied_object.removeAttribute('tied_template');
  },

  update_object: function(values){
    if(this.template != null){
      this.tied_object.update(this.template.evaluate(values));
    }
  }
});

var TiedInsert = TiedObject.subclass_it('insert_tie', {
  initialize: function(tied_object, object_id, tied_attribute, insert_on, tied_template){
    this.tied_object    = tied_object;
    this.object_id      = object_id      || tied_object.readAttribute('tied_object');
    this.tied_attribute = tied_attribute || tied_object.readAttribute('tied_attribute');
    this.insert_on      = insert_on      || tied_object.readAttribute('insert_on') || 'top';
    this.load_static_template( tied_template || tied_object.readAttribute('tied_template') );
    tied_object.removeAttribute('tied_object');
    tied_object.removeAttribute('tied_attribute');
    tied_object.removeAttribute('insert_on');
    tied_object.removeAttribute('tied_template');
  },

  update_object: function(values){
    if(this.template != null){
      var insertion = {};
      insertion[this.insert_on] = this.template.evaluate(values);
      this.tied_object.insert(insertion);
    }
  }
});

var MultipleTies = TiedObject.subclass_it('multiple_ties', {
  initialize: function(tied_object, object_id, tied_attributes){
    this.tied_object     = tied_object;
    this.object_id       = object_id       || tied_object.readAttribute('tied_object');
    this.tied_attributes = tied_attributes || tied_object.readAttribute('tied_attributes').gsub(' ', '').split(',').inject({}, function(hash, elem){
      key_value = elem.split(':');
      hash[key_value[0]] = key_value[1];
      return hash;
    });
    tied_object.removeAttribute('tied_object');
    tied_object.removeAttribute('tied_attributes');
  },

  subscribe: function(){
    SourceObject.find_or_create(this.object_id);
    var that = this;
    $H(this.tied_attributes).each(function(pair){
      document.observe('tied:'+that.object_id+':'+pair.key, function(event){
        that.update_object(pair.value, event.memo.tied_attribute);
      });
    });
  },

  refresh: function(){
    var source_object = SourceObject.find_or_create(this.object_id);
    var that = this;
    $H(this.tied_attributes).each(function(pair){
      that.update_object(pair.value, source_object.tied_attributes[pair.key]);
    });
  },

  update_object: function(tied_on, value){
    if(tied_on == 'inner_text'){
      this.tied_object.update(value);
    }else{
      this.tied_object.setAttribute(tied_on, value);
    }
  }
});

WebSocketTie.max_attempts = 3;
WebSocketTie.retry_timeout = 2000;
WebSocketTie.prototype = {
  initialize: function(path, max_attempts, retry_timeout){
    this.path          = path;
    this.max_attempts  = max_attempts  || WebSocketTie.max_attempts;
    this.retry_timeout = retry_timeout || WebSocketTie.retry_timeout;
    this.attempts      = 0;
    this.init_websocket();
  },

  send_form: function(form){
    elements = form.getElements().findAll(function(elem){ return elem.name != '' && elem.name != null; });
    var data = {};
    elements.each(function(elem){ data[elem.name] = elem.value; });
    this.send(data);
  },

  send: function(data){
    this.socket.send(Object.toJSON(data));
  },

  reconnect: function(){
    this.attempts = 0;
    init_websocket();
  },

  init_websocket: function(){
    this.closed = false;
    this.attempts += 1;
    this.socket = new WebSocket(this.path);

    var that = this;
    this.socket.onmessage = function(e){
      if( e.data == 'CLOSE' ){
        that.closed = true;
        that.socket.close();
      }else{
        var result = e.data.evalJSON(true);
        $H(result).each(function(pair){
          if(Tie(pair.key) != null){
            Tie(pair.key).update_attributes(pair.value);
          }
        });
      }
    };

    this.socket.onclose = function(){
      if(that.attempts < WebSocketTie.max_attempts && that.closed == false){
        setTimeout(function(that){that.init_websocket()}, WebSocketTie.retry_timeout);
      }
    };
  }
}
