// Cocos Shader 基础入门（四）：纹理映射 —— 修复版
// 对照原文修复的点：
//   1. render 必须接收 image（原文 function render() 缺参数 → ReferenceError: image is not defined，白屏）
//   2. 上传纹理前需 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)，否则图片上下颠倒
//   3. image.src 改成本机服务地址（同源加载，避免跨域 SecurityError）
// 文中案例：① 基础纹理(单图) ② 双纹理相乘 ③ 顶点色混合 ④ RGB 反转

// 服务地址：优先使用用户给定的 192.168.1.21:8080；若页面是从同源的其它地址（如 127.0.0.1:8080）
// 打开，则自动回退到当前页面 origin，避免跨域。务必从同一 origin 打开页面与图片。
const TARGET = "http://192.168.1.21:8080";
const SERVER = (location.origin === TARGET) ? TARGET : location.origin;
const IMG = { icon: SERVER + "/icon.png", close: SERVER + "/close-icon.png" };

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
    }
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return program;
    }
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// 顶点着色器：所有案例共用（pos + uv + color 交错缓冲）
const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_uv;
attribute vec4 a_color;
varying vec4 v_color;
varying vec2 v_uv;
void main() {
    v_color = a_color;
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// 各案例对应的片元着色器
const fragmentShaders = {
    // ① 基础纹理：直接采样显示
    single: `
    precision mediump float;
    varying vec2 v_uv;
    varying vec4 v_color;
    uniform sampler2D u_image;
    void main() {
        gl_FragColor = texture2D(u_image, v_uv);
    }`,
    // ② 双纹理相乘：两张纹理按相同 uv 采样后颜色相乘（白×原色=原色，黑×原色=黑）
    multi: `
    precision mediump float;
    varying vec2 v_uv;
    varying vec4 v_color;
    uniform sampler2D u_image0;
    uniform sampler2D u_image1;
    void main() {
        vec4 tex1 = texture2D(u_image0, v_uv);
        vec4 tex2 = texture2D(u_image1, v_uv);
        gl_FragColor = tex1 * tex2;
    }`,
    // ③ 顶点色混合：纹理色与顶点色相乘（镭射卡效果）
    color: `
    precision mediump float;
    varying vec2 v_uv;
    varying vec4 v_color;
    uniform sampler2D u_image;
    void main() {
        vec4 tex1 = texture2D(u_image, v_uv);
        gl_FragColor = tex1 * v_color;
    }`,
    // ④ RGB 反转：把红蓝通道对调
    bgra: `
    precision mediump float;
    varying vec2 v_uv;
    varying vec4 v_color;
    uniform sampler2D u_image;
    void main() {
        gl_FragColor = texture2D(u_image, v_uv).bgra;
    }`
};

// 构建交错缓冲：pos(2×float=8B) + uv(2×float=8B) + color(4×byte=4B) → stride 20 字节
function buildGeometry(gl, ratio) {
    const positions = [
        -ratio, -1,
        -ratio, 1,
        ratio, -1,
        ratio, 1
    ];
    const uvs = [
        0, 0, // 左下角
        0, 1, // 左上角
        1, 0, // 右下角
        1, 1  // 右上角
    ];
    // 顶点色（仅在 color 模式参与计算）
    const colors = [
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 127, 0, 255
    ];
    const indices = [0, 1, 2, 2, 1, 3];

    const arrayBuffer = new ArrayBuffer((positions.length + uvs.length) * 4 + colors.length);
    const float32Buffer = new Float32Array(arrayBuffer);
    const colorBuffer = new Uint8Array(arrayBuffer);

    let offset = 0;
    for (let i = 0; i < positions.length; i += 2) {
        float32Buffer[offset] = positions[i];
        float32Buffer[offset + 1] = positions[i + 1];
        offset += 5;
    }
    offset = 2;
    for (let i = 0; i < uvs.length; i += 2) {
        float32Buffer[offset] = uvs[i];
        float32Buffer[offset + 1] = uvs[i + 1];
        offset += 5;
    }
    offset = 16;
    for (let j = 0; j < colors.length; j += 4) {
        colorBuffer[offset] = colors[j];
        colorBuffer[offset + 1] = colors[j + 1];
        colorBuffer[offset + 2] = colors[j + 2];
        colorBuffer[offset + 3] = colors[j + 3];
        offset += 20;
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, arrayBuffer, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return { vertexBuffer, indexBuffer, indices };
}

function render(mode, images) {
    const canvas = document.getElementById('gl') || (function () {
        const c = document.createElement('canvas');
        c.id = 'gl';
        document.body.appendChild(c);
        return c;
    })();
    canvas.width = 400;
    canvas.height = 300;

    const gl = canvas.getContext('webgl');
    if (!gl) {
        document.body.insertAdjacentHTML('beforeend', '<p style="color:red">当前浏览器不支持 WebGL</p>');
        return;
    }

    // ratio：单图按图片比例保证不变形；双图沿用原文固定 0.5
    const ratio = (mode === 'multi')
        ? 0.5
        : (images.icon.width / images.icon.height) / (canvas.width / canvas.height);

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaders[mode]);
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const geo = buildGeometry(gl, ratio);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 20, 0);

    const uvAttributeLocation = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(uvAttributeLocation);
    gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 20, 8);

    const colorAttributeLocation = gl.getAttribLocation(program, 'a_color');
    if (colorAttributeLocation >= 0) { // 仅 color 模式用到；其余模式可能被链接器优化掉，返回 -1
        gl.enableVertexAttribArray(colorAttributeLocation);
        gl.vertexAttribPointer(colorAttributeLocation, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vertexBuffer);

    // 纹理绑定：multi 两张（icon + close-icon），其余一张（icon）
    const samplers = (mode === 'multi')
        ? [['u_image0', images.icon], ['u_image1', images.close]]
        : [['u_image', images.icon]];

    for (let j = 0; j < samplers.length; j++) {
        const [name, img] = samplers[j];
        const loc = gl.getUniformLocation(program, name);
        gl.uniform1i(loc, j); // 指定该 sampler 使用第 j 个纹理单元
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + j);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // 关键：上传前翻转 Y，纠正图片上下颠倒
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.indexBuffer);
    gl.drawElements(gl.TRIANGLES, geo.indices.length, gl.UNSIGNED_SHORT, 0);

    // 自检：读回像素，确认确实画出了内容（非背景像素数量）
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBg = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBg++;
    }
    console.log('RENDER_DONE mode=' + mode + ' nonBgPixels=' + nonBg);
}

function main() {
    // 控制按钮
    const box = document.createElement('div');
    box.innerHTML = `
        <p><b>纹理映射案例（修复版，对应《WEBGL 纹理映射 基本》）</b></p>
        <button data-mode="single">① 基础纹理(单图)</button>
        <button data-mode="multi">② 双纹理相乘</button>
        <button data-mode="color">③ 顶点色混合</button>
        <button data-mode="bgra">④ RGB反转</button>
        <p style="color:#666;font-size:12px">请通过 <code>${TARGET}/shader.html</code> 同源打开本页（不可跨域混用地址）。</p>`;
    document.body.insertBefore(box, document.body.firstChild);
    box.addEventListener('click', function (e) {
        const btn = e.target.closest('button');
        if (!btn || !loaded.icon) return;
        render(btn.dataset.mode, loaded);
    });

    // 预加载图片（icon 必选；close 仅双纹理用到）
    const loaded = {};
    const keys = Object.keys(IMG);
    let left = keys.length;
    let failed = false;
    keys.forEach(function (k) {
        const img = new Image();
        img.onload = function () {
            loaded[k] = img;
            if (--left === 0 && !failed) {
                // 支持 ?mode=xxx 直接指定初始案例（便于验证/分享）
                const params = new URLSearchParams(location.search);
                const init = params.get('mode') || 'single';
                render(init, loaded);
            }
        };
        img.onerror = function () {
            failed = true;
            document.body.insertAdjacentHTML('beforeend',
                '<p style="color:red">图片加载失败：' + IMG[k] +
                '<br>请确认从同一地址（' + TARGET + '）打开本页面，不要跨域混用 127.0.0.1 / 192.168.x.x。</p>');
        };
        img.src = IMG[k];
    });
}

main();
