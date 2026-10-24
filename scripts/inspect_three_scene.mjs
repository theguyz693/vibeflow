// Analyze the global transform and bounds of gltf.scene nodes in Three.js
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import fs from 'fs'

// Read buffer
const buf = fs.readFileSync('public/models/mp3_player.glb')
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

const loader = new GLTFLoader()
loader.parse(arrayBuffer, '', (gltf) => {
  const box = new THREE.Box3().setFromObject(gltf.scene)
  console.log('Scene Box Min:', box.min.toArray().map(v => v.toFixed(3)))
  console.log('Scene Box Max:', box.max.toArray().map(v => v.toFixed(3)))
  console.log('Scene Size:', box.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)))
  console.log('Scene Center:', box.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(3)))

  gltf.scene.traverse((obj) => {
    console.log(`Node: "${obj.name}" type: ${obj.type}`)
    if (obj.isMesh) {
      const gBox = new THREE.Box3().setFromBufferAttribute(obj.geometry.attributes.position)
      console.log(`  Mesh Geo Box Min:`, gBox.min.toArray().map(v => v.toFixed(3)))
      console.log(`  Mesh Geo Box Max:`, gBox.max.toArray().map(v => v.toFixed(3)))
      console.log(`  Mesh World Pos:`, obj.getWorldPosition(new THREE.Vector3()).toArray().map(v => v.toFixed(3)))
      console.log(`  Mesh World Rot:`, obj.getWorldRotation(new THREE.Euler()).toArray().slice(0, 3).map(v => v.toFixed(3)))
      console.log(`  Mesh World Scale:`, obj.getWorldScale(new THREE.Vector3()).toArray().map(v => v.toFixed(3)))
    }
  })
}, (err) => console.error(err))
