import * as THREE from 'three';
import * as dat from './dat.gui.module.js';
import { Stats } from './stats.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var scene, camera, renderer, controls, stats, sim_n_prop_cont, sim_m_prop_cont;
var points;
var xAxis, yAxis, zAxis;
var xzgrid;
const NUMPOINTS = 600000;
const distance_from_origin_setup = [];

const gui = new dat.GUI( {width : 400} )
gui.domElement.id = 'gui';

const MILLISECONDS_IN_SECOND = 1000
const ANIMATION_SPEED_SCALE = 0.00000000002
var ticks, delta_time 
var g_previous_ticks = 0
var frame_count = 0

const simulation = {
    threshold: 0.5,
    speed: 0.5,
    n_proportion: 0.5,
    n_sqrt_proportion: 1/Math.SQRT2,
    m_proportion: 0.5,
    m_sqrt_proportion: 1/Math.SQRT2,
}

const settings = {
    center_bar: true,
    enable_axis: true,
    enable_grid: true,
    enable_rotation_controls: false,
    rotation_matrix: new THREE.Euler(0,0,0),
    distance_between_atoms: 30,
}

window.addEventListener('resize', function(event) {
    var SCREEN_WIDTH = window.innerWidth;
    var SCREEN_HEIGHT = window.innerHeight;
    var ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT

    camera.aspect = ASPECT;
    camera.updateProjectionMatrix();
    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
}, true);


function init(){
    // SCENE
    scene = new THREE.Scene();

    // CAMERA
    var SCREEN_WIDTH = window.innerWidth; 
    var SCREEN_HEIGHT = window.innerHeight;
	var VIEW_ANGLE = 75;
    var ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT
    var NEAR = 0.1; 
    var FAR = 200000;

    camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR)
    scene.add(camera);
    camera.position.set(6,3,6);
    camera.lookAt(scene.position);
    

    // RENDERER
    renderer = new THREE.WebGLRenderer( {antialias:true} );

    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
    document.body.appendChild( renderer.domElement );

    // CAMERA CONTROLS
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingfactor = 0.001;

    // STATISTICS
    stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.bottom = '0px';
	stats.domElement.style.zIndex = 100;
	document.body.appendChild( stats.domElement );

    // GUI
    const simulationFolder = gui.addFolder('Simulation Settings')
    simulationFolder.add(simulation, 'threshold', 0.01, 0.999).step(0.001).name('Probability Threshold')
    simulationFolder.add(simulation, 'speed', 0, 1).step(0.01).name('Animation Speed')
    sim_n_prop_cont = simulationFolder.add(simulation, 'n_proportion', 0, 1).step(0.01).name('1s proportion')
    sim_m_prop_cont = simulationFolder.add(simulation, 'm_proportion', 0, 1).step(0.01).name('2pz proportion')
    
    const settingsFolder = gui.addFolder('Settings')
    settingsFolder.add(settings, 'enable_axis', false,true).name('Enable XYZ Axis')
    settingsFolder.add(settings, 'enable_grid', false,true).name('Enable XY Grid')

    var obj = { Click_here_to_reset:function(){ 
        simulation.speed = 5;
        settings.enable_axis = false;
        settings.enable_grid = true;
        camera.position.set(0,3,15);
        camera.lookAt(scene.position);
        gui.updateDisplay()
    }};
    settingsFolder.add(obj,'Click_here_to_reset');


    // LIGHTS
    var light = new THREE.PointLight(0xffffff);
	light.position.set(0,0,0);
	scene.add(light);

    
    // ----- GRID -----
    xzgrid = new THREE.GridHelper(50, 50);
    scene.add(xzgrid);

    // Create materials for each axis
    const axis_radius = 0.05;
    const axis_length = 10000;

    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for X
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green for Y
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue for Z

    // Create geometries for each axis
    const AxisGeometry = new THREE.CylinderGeometry(axis_radius, axis_radius, axis_length, 12);

    // Create lines for each axis
    xAxis = new THREE.Mesh(AxisGeometry, xAxisMaterial);
    yAxis = new THREE.Mesh(AxisGeometry, yAxisMaterial);
    zAxis = new THREE.Mesh(AxisGeometry, zAxisMaterial);

    xAxis.rotateZ(Math.PI/2);
    zAxis.rotateX(Math.PI/2);


    // Add the axes to the scene
    scene.add(xAxis);
    scene.add(yAxis);
    scene.add(zAxis);
    
    // ----- SHAPES -----
    const a = 1

    const positions = [];
    const wavefunction_1s_at_point = [], 
          wavefunction_2pz_at_point = [],
          wavefunction_1s_at_point_squared = [],
          wavefunction_2pz_at_point_squared = [];
    const theta = [], phi = [];
    const geometry = new THREE.BufferGeometry();
    const isActive = new Float32Array(NUMPOINTS); // 1 = visible, 0 = hidden
    const isLobe_1 = new Float32Array(NUMPOINTS)
    for (let i = 0; i < NUMPOINTS; i++) {
      const x = (Math.random() - 0.5) * 13;
      const y = (Math.random() - 0.5) * 13;
      const z = (Math.random() - 0.5) * 13;
      const distance = Math.sqrt(x*x + y*y + z*z)
      
      isLobe_1[i] = 1;
      
      isActive[i] = Math.random() > 0.5 ? 1.0 : 0.0;
      distance_from_origin_setup[i] = distance;

      theta[i] = Math.atan2(Math.sqrt(x*x + z*z) , y);
      phi[i] = Math.atan2(x, z)
      

      positions.push(x, y, z);

      //wavefunction_1s_at_point[i] = Math.E**(-distance);
      //wavefunction_2pz_at_point[i] = Math.cos(theta[i])*distance*Math.E**(-distance/2);

      wavefunction_1s_at_point[i] = Math.E**(-distance);
      wavefunction_1s_at_point_squared[i] = wavefunction_1s_at_point[i]**2;

      wavefunction_2pz_at_point[i] = 1.4*distance*Math.E**(-distance/2)*Math.sin(theta[i]);
      wavefunction_2pz_at_point_squared[i] = wavefunction_2pz_at_point[i]**2;
    }
  
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('distance_from_origin', new THREE.Float32BufferAttribute(distance_from_origin_setup, 1));
    geometry.setAttribute('theta', new THREE.Float32BufferAttribute(theta, 1));
    geometry.setAttribute('phi', new THREE.Float32BufferAttribute(phi, 1));
    geometry.setAttribute('isActive', new THREE.BufferAttribute(isActive, 1));
    geometry.setAttribute('isLobe_1', new THREE.BufferAttribute(isLobe_1, 1));

    geometry.setAttribute('wavefunction_1s_at_point', new THREE.Float32BufferAttribute(wavefunction_1s_at_point, 1));
    geometry.setAttribute('wavefunction_2pz_at_point', new THREE.Float32BufferAttribute(wavefunction_2pz_at_point, 1));
    geometry.setAttribute('wavefunction_1s_at_point_squared', new THREE.Float32BufferAttribute(wavefunction_1s_at_point_squared, 1));
    geometry.setAttribute('wavefunction_2pz_at_point_squared', new THREE.Float32BufferAttribute(wavefunction_2pz_at_point_squared, 1));

    // // === Shader Material with discard ===
    // const material = new THREE.ShaderMaterial({
    // vertexShader: `
    //     attribute float isActive;
    //     varying float vIsActive;
    //     attribute float isLobe_1;
    //     varying float visLobe_1;

    //     void main() {
    //     vIsActive = isActive;
    //     visLobe_1 = isLobe_1;
    //     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //     gl_PointSize = 6.0;
    //     }
    // `,
    // fragmentShader: `
    //     varying float vIsActive;
    //     varying float visLobe_1;

    //     void main() {
    //     if (vIsActive < 0.5) {discard;}
    //     else{
    //         if (visLobe_1 < 0.5) {
    //             gl_FragColor = vec4(0.2, 0.8, 1.0, 1.0);
    //         }
    //         else {
    //             gl_FragColor = vec4(1.0, 0.5, 0.5, 0.8);
    //     }}
    //     }
    // `,
    // transparent: true,
    // });

    // === Shader Material with discard ===
    const material = new THREE.ShaderMaterial({
    vertexShader: `
        attribute float isActive;
        varying float vIsActive;
        attribute float isLobe_1;
        varying float visLobe_1;

        uniform vec3 lightDirection;
        varying float vLight;

        void main() {
        vIsActive = isActive;
        visLobe_1 = isLobe_1;

        vec3 normal = normalize(position);
        vLight = max(dot(normal, normalize(lightDirection)), 0.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 6.0;
        }
    `,
    fragmentShader: `
        varying float vIsActive;
        varying float visLobe_1;
        varying float vLight;

        void main() {
        
            if (vIsActive < 0.5) {discard;}
            else{
                float ambient = 0.5;
                vec3 baseColor = vec3(0.2, 0.8, 1.0);
                if (visLobe_1 < 0.5) {
                    baseColor = vec3(0.2, 0.8, 1.0);
                }
                else {
                    baseColor = vec3(1.0, 0.5, 0.5);
                }
                vec3 shadedColor = baseColor * (ambient + vLight * 0.7);
                gl_FragColor = vec4(shadedColor, 1.0);
            }
        }
    `,
    uniforms: {
    lightDirection: { value: new THREE.Vector3(0, 1, 0) }
    },
    transparent: true,
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
}

function enableAxis(){
    xAxis.visible = true;
    yAxis.visible = true;
    zAxis.visible = true;
}
function disableAxis(){
    xAxis.visible = false;
    yAxis.visible = false;
    zAxis.visible = false;
}

function enableGrid(){xzgrid.visible = true;}
function disableGrid(){xzgrid.visible = false;}


init()
animate()

function input(){

    sim_n_prop_cont.onChange(function(newValue) {
    simulation.m_proportion = 1 - newValue
    simulation.m_sqrt_proportion = Math.sqrt(1 - newValue)
    simulation.n_sqrt_proportion = Math.sqrt(newValue)
    
    sim_n_prop_cont.updateDisplay()
    sim_m_prop_cont.updateDisplay()
} )

sim_m_prop_cont.onChange(function(newValue) {
    simulation.n_proportion = 1 - newValue
    simulation.m_sqrt_proportion = Math.sqrt(newValue)
    simulation.n_sqrt_proportion = Math.sqrt(1 - newValue)
    sim_n_prop_cont.updateDisplay()
    sim_m_prop_cont.updateDisplay()
    })
}


function update()
{
    ticks = Date.now() / MILLISECONDS_IN_SECOND;
    delta_time = ticks - g_previous_ticks;
    g_previous_ticks = ticks;

    frame_count += g_previous_ticks * ANIMATION_SPEED_SCALE * simulation.speed;

    if (settings.enable_axis){enableAxis();} else{disableAxis();}

    if (settings.enable_grid){enableGrid();} else{disableGrid();}

    //const distance_from_origin = points.geometry.attributes.distance_from_origin;
    const theta = points.geometry.attributes.theta;
    const is_active = points.geometry.attributes.isActive;
    const pos = points.geometry.attributes.position;
    //console.log(Math.E**-distance_from_origin.array[0])
    //console.log(is_active[0])

    const wavefunction_1s_at_point = points.geometry.attributes.wavefunction_1s_at_point;
    const wavefunction_2pz_at_point = points.geometry.attributes.wavefunction_2pz_at_point;
    const wavefunction_1s_at_point_squared = points.geometry.attributes.wavefunction_1s_at_point_squared;
    const wavefunction_2pz_at_point_squared = points.geometry.attributes.wavefunction_2pz_at_point_squared;
    const phi = points.geometry.attributes.phi;
    const isLobe_1 = points.geometry.attributes.isLobe_1;
    

    for (let i = 0; i < NUMPOINTS; i++) {
        
        // if (Math.abs(simulation.n_proportion * wavefunction_1s_at_point_squared.array[i] + 
        //     simulation.m_proportion * wavefunction_2pz_at_point_squared.array[i] + 
        //     simulation.n_proportion * simulation.m_proportion * 2 *
        //     wavefunction_1s_at_point.array[i] * wavefunction_2pz_at_point.array[i] * Math.cos(frame_count-phi.array[i])) > simulation.threshold/10){
        //     is_active.array[i] = 1
        // }

        if (Math.abs(2*wavefunction_1s_at_point.array[i]*wavefunction_2pz_at_point.array[i] * Math.cos(frame_count-phi.array[i])) > simulation.threshold/10){
            is_active.array[i] = 1;
            if (2*wavefunction_1s_at_point.array[i]*wavefunction_2pz_at_point.array[i] * Math.cos(frame_count-phi.array[i]) > simulation.threshold/10){
                isLobe_1.array[i] = 1;
            }
            else{
                isLobe_1.array[i] = 0;
            }

        }
        else{
            is_active.array[i] = 0;
        }
    }
    is_active.needsUpdate = true;
    isLobe_1.needsUpdate = true;
    
	controls.update();
	stats.update();
}


function render() 
{
	renderer.render( scene, camera );
}

function animate() {
    requestAnimationFrame( animate );
    input();
    update();
	render();
}
