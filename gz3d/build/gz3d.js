var GZ3D = GZ3D || {
  REVISION : '1'
};


GZ3D.GZIface = function(scene)
{
  this.scene = scene;
  this.Init();
};

GZ3D.GZIface.prototype.Init = function(scene)
{
  // Set up initial scene
  this.webSocket = new ROSLIB.Ros({
    url : 'ws://localhost:7681'
  });

  var sceneTopic = new ROSLIB.Topic({
    ros : this.webSocket,
    name : '~/scene',
    messageType : 'scene',
  });

  var SceneUpdate = function(message)
  {
    if (message.grid === true)
    {
      this.scene.CreateGrid();
    }

    for (var i = 0; i < message.light.length; ++i)
    {
      var light = message.light[i];
      var lightObj = this.CreateLightFromMsg(light);
      this.scene.Add(lightObj);
    }

    for (var j = 0; j < message.model.length; ++j)
    {
      var model = message.model[j];
      var modelObj = this.CreateModelFromMsg(model);
      this.scene.Add(modelObj);
    }
  };
  sceneTopic.subscribe(SceneUpdate.bind(this));


  // Update model pose
  var poseTopic = new ROSLIB.Topic({
    ros : this.webSocket,
    name : '~/pose/info',
    messageType : 'pose',
  });

  var PoseUpdate = function(message)
  {
    var entity = this.scene.GetByName(message.name);
    if (entity)
    {
      entity.position = message.position;
      entity.quaternion = message.orientation;
    }
  };

  poseTopic.subscribe(PoseUpdate.bind(this));

  // Requests - for deleting models
  var requestTopic = new ROSLIB.Topic({
    ros : this.webSocket,
    name : '~/request',
    messageType : 'request',
  });

  var RequestUpdate = function(message)
  {
    if (message.request === 'entity_delete')
    {
      var entity = this.scene.GetByName(message.data);
      if (entity)
      {
        this.scene.Remove(entity);
      }
    }
  };

  requestTopic.subscribe(RequestUpdate.bind(this));

  // Model info messages - currently used for spawning new models
  var modelInfoTopic = new ROSLIB.Topic({
    ros : this.webSocket,
    name : '~/model/info',
    messageType : 'model',
  });

  var ModelUpdate = function(message)
  {
    var modelObj = this.CreateModelFromMsg(message);
    this.scene.Add(modelObj);
  };

  modelInfoTopic.subscribe(ModelUpdate.bind(this));


  // Lights
  var lightTopic = new ROSLIB.Topic({
    ros : this.webSocket,
    name : '~/light',
    messageType : 'light',
  });

  var LigthtUpdate = function(message)
  {
    var lightObj = this.CreateLightFromMsg(message);
    this.scene.Add(lightObj);
  };

  lightTopic.subscribe(LigthtUpdate.bind(this));
};

GZ3D.GZIface.prototype.CreateModelFromMsg = function(model)
{
  var modelObj = new THREE.Object3D();
  modelObj.name = model.name;
  if (model.pose)
  {
    modelObj.position = model.pose.position;
    modelObj.quaternion = model.pose.orientation;
  }
  for (var j = 0; j < model.link.length; ++j)
  {
    var link = model.link[j];
    var linkObj = new THREE.Object3D();
    linkObj.name = link.name;
    if (link.pose)
    {
      linkObj.position = link.pose.position;
      linkObj.quaternion = link.pose.orientation;
    }
    modelObj.add(linkObj);
    for (var k = 0; k < link.visual.length; ++k)
    {
      var visual = link.visual[k];
      if (visual.geometry)
      {
        var geom = visual.geometry;
        var visualObj = new THREE.Object3D();
        visualObj.name = visual.name;
        if (visual.pose)
        {
          visualObj.position = visual.pose.position;
          visualObj.quaternion = visual.pose.orientation;
        }
        // TODO  mat = FindMaterial(material);
        this.scene.CreateGeom(geom, visual.material, visualObj);
        linkObj.add(visualObj);
      }
    }
  }
  return modelObj;
};




GZ3D.GZIface.prototype.CreateLightFromMsg = function(light)
{
  var rgbToHex = function(R,G,B)
  {
    var toHex = function(n)
    {
      n = parseInt(n,10);
      if (isNaN(n))
      {
        return '00';
      }
      n = Math.max(0,Math.min(n,255));
      return '0123456789ABCDEF'.charAt((n-n%16)/16)
          + '0123456789ABCDEF'.charAt(n%16);
    };
    return toHex(R) + toHex(G) + toHex(B);
  };

  var lightObj;
//  var color = rgbToHex(light.diffuse.r*255, light.diffuse.g*255,
//      light.diffuse.b*255);
  var color = 'rgb(' + light.diffuse.r*255 + ',' + light.diffuse.g*255 + ',' +
      light.diffuse.b*255 + ')';
  if (light.type === 1)
  {
    lightObj = new THREE.PointLight(color);
    lightObj.distance = light.range;
  }
  if (light.type === 2)
  {
    lightObj = new THREE.SpotLight(color);
    lightObj.distance = light.range;
  }
  else if (light.type === 3)
  {
    lightObj = new THREE.DirectionalLight(color);
  }

  lightObj.intensity = light.attenuation_constant;
  lightObj.castShadow = light.cast_shadows;

  if (light.pose)
  {
    lightObj.position = light.pose.position;
    lightObj.quaternion = light.pose.orientation;
  }
  lightObj.name = light.name;

  return lightObj;
};

GZ3D.Scene = function()
{
  this.Init();
};


GZ3D.Scene.prototype.Init = function()
{
  this.scene = new THREE.Scene();
  // scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );
/*  var geometry = new THREE.CylinderGeometry( 0, 1, 3, 4, 1 );
  var material =  new THREE.MeshLambertMaterial(
      { color:0xffffff, shading: THREE.FlatShading } );
  var mesh = new THREE.Mesh( geometry, material );
  mesh.position.x = 0;
  mesh.position.y = 0;
  mesh.position.z = 0;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  this.scene.add( mesh );*/

  this.renderer = new THREE.WebGLRenderer({antialias: false });
  this.renderer.setClearColor(0xcccccc, 1);
  this.renderer.setSize( window.innerWidth, window.innerHeight);

  // lights
  var light = new THREE.AmbientLight( 0x222222 );
  this.scene.add(light);

  this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 1, 1000 );
  this.camera.position.x = 0;
  this.camera.position.y = -5;
  this.camera.position.z = 5;
  this.camera.up = new THREE.Vector3(0, 0, 1);
  this.camera.lookAt(0, 0, 0);


  this.controls = new THREE.TrackballControls(this.camera);
  this.controls.rotateSpeed = 1.0;
  this.controls.zoomSpeed = 1.2;
  this.controls.panSpeed = 0.8;
  this.controls.noZoom = false;
  this.controls.noPan = false;
  this.controls.staticMoving = true;
  this.controls.dynamicDampingFactor = 0.3;
  this.controls.keys = [ 65, 83, 68 ];

  this.controls.addEventListener('change', this.Render.call(this));

  this.iface = new GZ3D.GZIface(this);

};

GZ3D.Scene.prototype.GetDomElement = function()
{
  return this.renderer.domElement;
};


GZ3D.Scene.prototype.Render = function()
{
  this.renderer.render(this.scene, this.camera);
  this.controls.update();
};


GZ3D.Scene.prototype.SetWindowSize = function(width, height)
{
  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();

  this.renderer.setSize( width, height);
  this.controls.handleResize();
  this.Render();
};

GZ3D.Scene.prototype.Add = function(model)
{
  this.scene.add(model);
};

GZ3D.Scene.prototype.Remove = function(model)
{
  this.scene.remove(model);
};

GZ3D.Scene.prototype.GetByName = function(name)
{
  return this.scene.getObjectByName(name);
};

GZ3D.Scene.prototype.CreateGeom  = function(geom, material, parent)
{
  var mesh;
  if (geom.box)
  {
    mesh = this.CreateBox(geom.box.size.x, geom.box.size.y, geom.box.size.z);
  }
  if (geom.cylinder)
  {
    mesh = this.CreateCylinder(geom.cylinder.radius, geom.cylinder.length);
  }
  if (geom.sphere)
  {
    mesh = this.CreateSphere(geom.sphere.radius);
  }

  if (mesh)
  {
    mesh.updateMatrix();
    parent.add(mesh);
  }
};

GZ3D.Scene.prototype.CreateGrid = function()
{
  var grid = new THREE.GridHelper(10, 1);
  grid.rotation.x = Math.PI * 0.5;
  this.scene.add(grid);
};

GZ3D.Scene.prototype.CreateSphere = function(radius)
{
  var geometry = new THREE.SphereGeometry(radius, 32, 32);
  var material =  new THREE.MeshPhongMaterial(
      {color:0xffffff, shading: THREE.SmoothShading} );
  var mesh = new THREE.Mesh(geometry, material);
  return mesh;
};


GZ3D.Scene.prototype.CreateCylinder = function(radius, length)
{
  var geometry = new THREE.CylinderGeometry(radius, radius, length, 32, 1,
      false);
  var material =  new THREE.MeshPhongMaterial(
      {color:0xffffff, shading: THREE.SmoothShading} );
  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI * 0.5;
  return mesh;
};

GZ3D.Scene.prototype.CreateBox = function(width, height, depth)
{
  var geometry = new THREE.CubeGeometry(width, height, depth, 1, 1, 1);
  var material =  new THREE.MeshPhongMaterial(
      {color:0xffffff, shading: THREE.SmoothShading} );
  var mesh = new THREE.Mesh(geometry, material);
  return mesh;
};
