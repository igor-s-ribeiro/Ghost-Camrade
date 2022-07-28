import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let config = {
    dotsNumber: 11,
    dotsBaseRadius: window.innerHeight * .1,
    tailSpring: .35,
    tailGravity: window.innerHeight * .005,
    tailGravityBonds: [window.innerHeight * .005, window.innerHeight * .01],
    tailFriction: .5,
    faceExpression: 0,
    catchingSpeed: window.innerWidth * .0001,
};



class Viz {

    constructor() {
        this.renderer = new THREE.WebGLRenderer({});
        this.container = document.getElementsByClassName('viz')[0];
        this.container.appendChild(this.renderer.domElement);
        this.camera = new THREE.OrthographicCamera(
            -.5 * window.innerWidth,
            .5 * window.innerWidth,
            .5 * window.innerHeight,
            -.5 * window.innerHeight,
            0.1,
            10,
        );
        this.camera.position.set(0, 0, 1);

        this.clock = new THREE.Clock();

        this.scene = new THREE.Scene();

        this.touchPoint = new THREE.Vector2(.5, .65);
        this.targetTouchPoint = new THREE.Vector2(.5, .65);
        this.touchCanvasPoint = [ this.touchPoint.x * window.innerWidth, (1 - this.touchPoint.y) * window.innerHeight ];
        this.isMoving = false;

        this.touchCanvas = document.createElement('canvas');
        this.touchCanvasCtx = this.touchCanvas.getContext('2d');
        this.touchTexture = new THREE.CanvasTexture(this.touchCanvas);
        this.touchTrail = new Array(config.dotsNumber);
        for (let i = 0; i < config.dotsNumber; i++) {
            this.touchTrail[i] = {
                x: this.touchCanvasPoint[0],
                y: this.touchCanvasPoint[1],
                vx: 0,
                vy: 0,
                intensity: i ? .6 * (config.dotsNumber - i) / config.dotsNumber : .9,
                r: config.dotsBaseRadius * (1 + Math.pow(i / config.dotsNumber, .5))
            }
        }

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                u_touch_texture: {type: 't', value: this.touchTexture},
                u_mouse: { type: 'v2', value: new THREE.Vector2(0, 0) },
                u_target_mouse: { type: 'v2', value: new THREE.Vector2(0, 0) },
                u_resolution: { type: 'v2', value: new THREE.Vector2(0, 0) },
                u_time: { type: 'f', value: 0 },
                u_face_expression: { type: 'f', value: config.faceExpression },
                u_ratio: { type: 'f', value: window.innerWidth / window.innerHeight },
            },
            vertexShader: document.getElementById('vertexShader').textContent,
            fragmentShader: document.getElementById('fragmentShader').textContent
        });

        const planeGeometry = new THREE.PlaneBufferGeometry(2, 2);
        this.scene.add(new THREE.Mesh(planeGeometry, this.material));


        this.addCanvasEvents();
    }

    addCanvasEvents() {
        const _this = this;

        let movingTimer;
        let movingTimeout = function () {
            _this.isMoving = false;
        };
        movingTimer = setTimeout(movingTimeout, 300);

        window.addEventListener('mousemove', (e) => {
            updateMousePosition(e.clientX, e.clientY);
        });
        window.addEventListener('touchmove', (e) => {
            updateMousePosition(e.targetTouches[0].pageX, e.targetTouches[0].pageY);
        });

        function updateMousePosition(eX, eY) {
            if (_this.isMoving === false) {
                _this.isMoving = true;
            }
            clearTimeout(movingTimer);
            movingTimer = setTimeout(movingTimeout, 300);

            _this.targetTouchPoint.x = eX / window.innerWidth;
            _this.targetTouchPoint.y = 1.1 - Math.max(eY / window.innerHeight, .2);
        }
    }

    updateTrail() {
        this.touchCanvasCtx.fillStyle = 'black';
        this.touchCanvasCtx.fillRect(0, 0, this.touchCanvas.width, this.touchCanvas.height);

        this.touchTrail.forEach((p, pIdx) => {
            if (pIdx === 0) {
                p.x = this.touchCanvasPoint[0];
                p.y = this.touchCanvasPoint[1];
            } else {
                p.vx += (this.touchTrail[pIdx - 1].x - p.x) * config.tailSpring;
                p.vx *= config.tailFriction;

                p.vy += (this.touchTrail[pIdx - 1].y - p.y) * config.tailSpring;
                p.vy += config.tailGravity;
                p.vy *= config.tailFriction;

                p.x += p.vx;
                p.y += p.vy;
            }

            const grd = this.touchCanvasCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grd.addColorStop(0, 'rgba(255, 255, 255, ' + p.intensity + ')');
            grd.addColorStop(1, 'rgba(255, 255, 255, 0)');

            this.touchCanvasCtx.beginPath();
            this.touchCanvasCtx.fillStyle = grd;
            this.touchCanvasCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.touchCanvasCtx.fill();
        });

        this.touchTexture.needsUpdate = true;
    }

    render() {
        this.touchPoint.x += (this.targetTouchPoint.x - this.touchPoint.x) * config.catchingSpeed;
        this.touchPoint.y += (this.targetTouchPoint.y - this.touchPoint.y) * config.catchingSpeed;
        this.touchCanvasPoint = [ this.touchPoint.x * window.innerWidth, (1 - this.touchPoint.y) * window.innerHeight ];

        const time = this.clock.getElapsedTime();

        if (this.isMoving) {
            config.faceExpression -= .05;
            config.faceExpression = Math.max(config.faceExpression, 0);
            config.tailGravity -= .1;
            config.tailGravity = Math.max(config.tailGravity, config.tailGravityBonds[0]);
        } else {
            config.faceExpression += .01;
            config.faceExpression = Math.min(config.faceExpression, 1);
            config.tailGravity += .1;
            config.tailGravity = Math.min(config.tailGravity, config.tailGravityBonds[1]);
        }
        config.tailGravity += .12 * Math.sin(3 * time);

        this.material.uniforms.u_face_expression.value = config.faceExpression;

        this.updateTrail();
        this.material.uniforms.u_touch_texture.value = this.touchTexture;

        this.material.uniforms.u_time.value = time;
        this.material.uniforms.u_mouse.value = new THREE.Vector2(this.touchPoint.x, this.touchPoint.y);
        this.material.uniforms.u_target_mouse.value = new THREE.Vector2(this.targetTouchPoint.x, this.targetTouchPoint.y);
        this.renderer.render(this.scene, this.camera);
    }

    loop() {
        this.render();
        requestAnimationFrame(this.loop.bind(this));
    }

    updateSize() {
        config.dotsBaseRadius = window.innerHeight * .1;
        config.tailGravity = window.innerHeight * .005;
        config.tailGravityBonds = [window.innerHeight * .005, window.innerHeight * .01];
        config.catchingSpeed = window.innerWidth * .0001;

        this.touchCanvas.width = window.innerWidth;
        this.touchCanvas.height = window.innerHeight;
        this.camera.left =  -.5 * window.innerWidth;
        this.camera.right = .5 * window.innerWidth;
        this.camera.top = .5 * window.innerHeight;
        this.camera.bottom = -.5 * window.innerHeight;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.material.uniforms.u_ratio.value = window.innerWidth / window.innerHeight;
        this.material.uniforms.u_resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}

const viz = new Viz();

viz.updateSize();
window.addEventListener('resize', () => viz.updateSize());

viz.loop();