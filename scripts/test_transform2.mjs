import * as THREE from 'three'

const rx90 = new THREE.Matrix4().makeRotationX(Math.PI / 2)
const mTotal = new THREE.Matrix4().fromArray([1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0.001,0,1])
const combined = new THREE.Matrix4().multiplyMatrices(rx90, mTotal)

console.log('Screen pos:', new THREE.Vector3(0, 1.0, 0.01).applyMatrix4(combined).toArray().map(v => +v.toFixed(3)))
console.log('Screen normal:', new THREE.Vector3(0, 0, 1).transformDirection(combined).toArray().map(v => +v.toFixed(3)))
console.log('Wheel pos:', new THREE.Vector3(0, -0.855, -0.034).applyMatrix4(combined).toArray().map(v => +v.toFixed(3)))
