import {vertex_shader_source, sd_fragment_shader} from './modules/basic.js';

function main() {
    const canvas = document.querySelector("#glCanvas");
    //Initialize the GL context
    const gl = canvas.getContext("webgl");

    //continue if WebGL is available
    if (gl === null) {
        alert("Webgl possibly unsupported");
        return;
    }

    const shader_program = initShaderProgram(gl, vertex_shader_source, sd_fragment_shader);

    //collect all the info needed to use the shader program

    const program_info = {
        program: shader_program,
        attribLocations: {
            vertex_position: gl.getAttribLocation(shader_program, 'a_vertex_position'),
        },
        uniformLocations: {
            time : gl.getUniformLocation(shader_program, 'u_time'),
            projection_matrix: gl.getUniformLocation(shader_program, 'u_projection_matrix'),
            model_view_matrix: gl.getUniformLocation(shader_program, 'u_model_view_matrix'),
        },
    };

    const buffers = initBuffers(gl);

    var then = 0.0;
    function render(now) {
        now *= 0.001; //convert to seconds
        const delta_time = now - then;
        then = now;

        drawScene(gl, program_info, buffers, now);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function initBuffers(gl) {
    //create buffer for square's positions.
    const position_buffer = gl.createBuffer();

    //select position_buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);

    //array of positions for square
    const positions = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0,
    ];

    ///pass to webgl
    gl.bufferData(gl.ARRAY_BUFFER,
                    new Float32Array(positions),
                    gl.STATIC_DRAW);

    return {
        position: position_buffer,
    };
}

function drawScene(gl, program_info, buffers, time) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0); //clear to black
    gl.clearDepth(1.0); //clear everything
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEWUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const field_of_view = 45.0 * Math.PI / 180.0;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const z_near = 0.1;
    const z_far = 100.0
    const projection_matrix = mat4.create();

    mat4.perspective(projection_matrix,
        field_of_view,
        aspect,
        z_near,
        z_far);

    //set the drawing position to the identity point

    const model_view_matrix = mat4.create();

    //move it
    mat4.translate(model_view_matrix,
        model_view_matrix,
        [-0.0, 0.0, -1.0]);

    //tell webgl ohw to pull out positions from the position buffer into vertex
    //position
    {
        const num_components = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            program_info.attribLocations.vertex_position,
            num_components,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            program_info.attribLocations.vertex_position);
    }

    gl.useProgram(program_info.program);

    //set shader uniforms
    gl.uniform1f(program_info.uniformLocations.time,
        time);

    gl.uniformMatrix4fv(
        program_info.uniformLocations.projection_matrix,
        false,
        projection_matrix);
    gl.uniformMatrix4fv(
        program_info.uniformLocations.model_view_matrix,
        false,
        model_view_matrix);
    {
        const offset = 0;
        const vertex_count = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertex_count);
    }
}



function initShaderProgram(gl, vs_source, fs_source) {
    const vertex_shader = loadShader(gl, gl.VERTEX_SHADER, vs_source);
    const fragment_shader = loadShader(gl, gl.FRAGMENT_SHADER, fs_source);

    //create the shader program
    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shader_program));
        return null;
    }

    return shader_program;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    //send source to shader object
    gl.shaderSource(shader, source);

    //compile the shader program

    gl.compileShader(shader);

    //see if compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}


window.onload = main;
