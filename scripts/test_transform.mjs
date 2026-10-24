import * as THREE from 'three'

// Multiply the 4 node matrices from our inspector:
// Node 0:
const m0 = new THREE.Matrix4().fromArray([1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0,0,1])
// Node 1:
const m1 = new THREE.Matrix4().fromArray([0.01,0,0,0, 0,0,0.01,0, 0,-0.01,0,0, 0,0,0,1])
// Node 2: RootNode = identity
const m2 = new THREE.Matrix4().identity()
// Node 3:
const m3 = new THREE.Matrix4().fromArray([100,0,0,0, 0,0,-100,0, 0,100,0,0, 0,0.14,0,1])

const total = new THREE.Matrix4().multiply(m0).multiply(m1).multiply(m2).multiply(m3)
console.log('Total world matrix on the mesh:', total.elements.map(v => +v.toFixed(3)))

// Test screen center in mesh local coords: (0, 1.0, 0.0)
const vScreen = new THREE.Vector3(0, 1.0, 0.0).applyMatrix4(total)
console.log('Screen world pos:', vScreen.toArray().map(v => +v.toFixed(3)))

// Test screen normal in mesh local coords: (0, 0, 1)
const vNrm = new THREE.Vector3(0, 0, 1).transformDirection(total)
console.log('Screen world normal:', vNrm.toArray().map(v => +v.toFixed(3)))

// Test wheel center in mesh local coords: (0, -0.855, -0.034)
const vWheel = new THREE.Vector3(0, -0.855, -0.034).applyMatrix4(total)
console.log('Wheel world pos:', vWheel.toArray().map(v => +v.toFixed(3)))
