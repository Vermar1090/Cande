
// Configuración de Supabase
const supabaseUrl = "https://kntorhiruncbnhvvyint.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9yaGlydW5jYm5odnZ5aW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTY1NjYsImV4cCI6MjA2ODM5MjU2Nn0.PpHPi0p0e_pdTloQip0X6-_NKG7KhHw89t4Yyrvm5ow";

// Inicializar Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales
let categorias = [];
let productos = [];
let supabaseReady = false;
let bucketName = 'productos-imagenes';

// Formatos de imagen soportados - Ahora acepta TODOS los tipos de imagen
const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/tif',
    'image/ico',
    'image/icon',
    'image/x-icon',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-png',
    'image/pjpeg'
];

// Extensiones de archivo soportadas
const SUPPORTED_IMAGE_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', 
    '.bmp', '.tiff', '.tif', '.ico', '.avif', '.heic', '.heif'
];

// Esperar a que Supabase esté listo
window.addEventListener('load', function() {
    supabaseReady = true;
    cargarCategorias();
});

// Función para validar si es una imagen
function isValidImageFile(file) {
    // Verificar tipo MIME
    if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return true;
    }
    
    // Si el tipo MIME no es reconocido, verificar por extensión
    const fileName = file.name.toLowerCase();
    return SUPPORTED_IMAGE_EXTENSIONS.some(ext => fileName.endsWith(ext));
}

// Función para obtener información del archivo
function getFileInfo(file) {
    const size = (file.size / 1024 / 1024).toFixed(2); // MB
    const type = file.type || 'Tipo desconocido';
    const extension = file.name.split('.').pop().toUpperCase();
    
    return {
        name: file.name,
        size: size,
        type: type,
        extension: extension,
        lastModified: new Date(file.lastModified).toLocaleDateString()
    };
}

// Función para mostrar información del archivo
function showFileInfo(file) {
    const info = getFileInfo(file);
    const fileInfoDiv = document.getElementById('fileInfo');
    
    fileInfoDiv.innerHTML = `
        <strong>Archivo seleccionado:</strong><br>
        📁 Nombre: ${info.name}<br>
        📏 Tamaño: ${info.size} MB<br>
        🏷️ Tipo: ${info.type}<br>
        📅 Modificado: ${info.lastModified}
    `;
    fileInfoDiv.style.display = 'block';
}

// Función para probar la conexión a Storage
async function testStorageConnection() {
    const bucketInput = document.getElementById('bucketName');
    const statusDiv = document.getElementById('connectionStatus');
    bucketName = bucketInput.value || 'productos-imagenes';
    
    try {
        // Intentar listar archivos del bucket
        const { data, error } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 });
        
        if (error) {
            throw error;
        }
        
        statusDiv.className = 'message success';
        statusDiv.textContent = '✅ Conexión exitosa al bucket: ' + bucketName;
        statusDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Error de conexión:', error);
        statusDiv.className = 'message error';
        statusDiv.textContent = '❌ Error: ' + error.message;
        statusDiv.style.display = 'block';
    }
}

// Función para subir archivo a Supabase Storage
async function uploadToSupabase(file) {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `productos/${fileName}`;
    try {
        // Subir archivo
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Obtener URL pública
        const { data: publicUrlData, error: urlError } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        if (urlError || !publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('No se pudo obtener la URL pública de la imagen');
        }

        return publicUrlData.publicUrl;

    } catch (error) {
        console.error('Error subiendo archivo:', error);
        throw error;
    }
}

// Función para manejar subida de archivos - MEJORADA
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) {
        document.getElementById('fileInfo').style.display = 'none';
        return;
    }
    
    // Mostrar información del archivo
    showFileInfo(file);
    
    // Validar que sea una imagen (ahora más permisivo)
    if (!isValidImageFile(file)) {
        mostrarMensaje('El archivo seleccionado no parece ser una imagen válida. Se intentará subir de cualquier manera.', 'warning');
        // No retornamos, permitimos continuar
    }
    
    // Validar tamaño (máximo 10MB - aumentado)
    if (file.size > 10 * 1024 * 1024) {
        mostrarMensaje('El archivo es demasiado grande (máximo 10MB)', 'error');
        return;
    }
    
    // Mostrar preview si es posible
    if (file.type.startsWith('image/') || isValidImageFile(file)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('imagePreview');
            img.src = e.target.result;
            img.style.display = 'block';
            
            // Manejar error de carga de imagen
            img.onerror = function() {
                console.log('No se pudo mostrar preview de la imagen');
                img.style.display = 'none';
            };
        };
        reader.readAsDataURL(file);
    }
    
    // Mostrar progreso
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const submitBtn = document.getElementById('submitBtn');
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    submitBtn.disabled = true;
    
    try {
        // Simular progreso
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            progressBar.style.width = progress + '%';
            if (progress >= 90) {
                clearInterval(progressInterval);
            }
        }, 100);
        
        // Subir archivo
        const imageUrl = await uploadToSupabase(file);
        
        // Completar progreso
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        
        // Guardar URL en campo oculto
        document.getElementById('productoImagen').value = imageUrl;
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            submitBtn.disabled = false;
            mostrarMensaje('Imagen subida correctamente', 'success');
        }, 500);
        
    } catch (error) {
        console.error('Error:', error);
        progressContainer.style.display = 'none';
        submitBtn.disabled = false;
        mostrarMensaje('Error al subir imagen: ' + error.message, 'error');
    }
}

// Funciones de navegación
function showTab(tabName) {
    if (!supabaseReady && tabName !== 'configuracion') {
        console.log('Supabase no está listo aún');
        return;
    }
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    // Guardar la pestaña activa en localStorage
    localStorage.setItem('tabActiva', tabName);
    
    if (tabName === 'categorias') {
        cargarCategorias();
    } else if (tabName === 'productos') {
        cargarProductos();
        cargarCategoriasSelect();
    }
}

// Funciones de Categorías
async function cargarCategorias() {
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .order('nombre');
        
        if (error) throw error;
        
        categorias = data || [];
        mostrarCategorias();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('categoriasList').innerHTML = 
            '<div class="error">Error al cargar categorías</div>';
    }
}

function mostrarCategorias() {
    const container = document.getElementById('categoriasList');
    
    if (categorias.length === 0) {
        container.innerHTML = '<div class="loading">No hay categorías</div>';
        return;
    }
    
    container.innerHTML = categorias.map(cat => `
        <div class="item">
            <div class="item-info">
                <div class="item-title">${cat.nombre}</div>
                <div class="item-description">${cat.descripcion || 'Sin descripción'}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-small" onclick="editarCategoria(${cat.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="eliminarCategoria(${cat.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function guardarCategoria(event) {
    event.preventDefault();
    
    const id = document.getElementById('categoriaId').value;
    const nombre = document.getElementById('categoriaNombre').value;
    const descripcion = document.getElementById('categoriaDescripcion').value;
    
    try {
        let result;
        if (id) {
            result = await supabase
                .from('categorias')
                .update({ nombre, descripcion })
                .eq('id', id);
        } else {
            result = await supabase
                .from('categorias')
                .insert([{ nombre, descripcion }]);
        }
        
        if (result.error) throw result.error;
        
        limpiarFormularioCategoria();
        cargarCategorias();
        mostrarMensaje('Categoría guardada', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar', 'error');
    }
}

function editarCategoria(id) {
    const categoria = categorias.find(c => c.id === id);
    if (categoria) {
        document.getElementById('categoriaId').value = categoria.id;
        document.getElementById('categoriaNombre').value = categoria.nombre;
        document.getElementById('categoriaDescripcion').value = categoria.descripcion || '';
    }
}

async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar categoría?')) return;
    
    try {
        const { error } = await supabase
            .from('categorias')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        cargarCategorias();
        mostrarMensaje('Categoría eliminada', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al eliminar', 'error');
    }
}

function limpiarFormularioCategoria() {
    document.getElementById('categoriaForm').reset();
    document.getElementById('categoriaId').value = '';
}

// Funciones de Productos
async function cargarProductos() {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select(`
                *,
                categoria:categorias(nombre)
            `)
            .order('nombre');
        
        if (error) throw error;
        
        productos = data || [];
        mostrarProductos();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('productosList').innerHTML = 
            '<div class="error">Error al cargar productos</div>';
    }
}

function mostrarProductos() {
    const container = document.getElementById('productosList');
    
    if (productos.length === 0) {
        container.innerHTML = '<div class="loading">No hay productos</div>';
        return;
    }
    
    container.innerHTML = productos.map(prod => `
        <div class="item">
            <div class="item-info">
                <div style="display: flex; align-items: center;">
                    ${prod.imagen ? `<img src="${prod.imagen}" alt="${prod.nombre}" class="product-image" onerror="this.style.display='none'">` : ''}
                    <div>
                       <div class="item-title">${prod.nombre}</div>
                        <div class="item-description">${prod.descripcion || 'Sin descripción'}</div>
                        <div class="item-description">Categoría: ${prod.categoria?.nombre || 'Sin categoría'}</div>
                    </div>
                </div>
                <div class="item-price">$${prod.precio}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-small" onclick="editarProducto(${prod.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="eliminarProducto(${prod.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function cargarCategoriasSelect() {
    const select = document.getElementById('productoCategoria');
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    categorias.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
    });
}

function getStoragePathFromUrl(url) {
    // Solo procesa si la URL es de Supabase Storage
    if (!url || !url.includes('/storage/v1/object/public/')) return null;
    const parts = url.split('/storage/v1/object/public/');
    if (parts.length < 2) return null;
    // El path es: productos-imagenes/productos/1234_nombre.jpg
    return parts[1];
}

async function guardarProducto(event) {
    event.preventDefault();

    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('productoNombre').value;
    const categoria_id = document.getElementById('productoCategoria').value;
    const descripcion = document.getElementById('productoDescripcion').value;
    const precio = parseFloat(document.getElementById('productoPrecio').value);
    const imagen = document.getElementById('productoImagen').value;

    if (!imagen) {
        mostrarMensaje('Debes subir una imagen antes de guardar el producto', 'error');
        return;
    }

    try {
        let result;
        if (id) {
            // Buscar el producto original para comparar la imagen
            const productoOriginal = productos.find(p => p.id == id);
            if (productoOriginal && productoOriginal.imagen && productoOriginal.imagen !== imagen) {
                // Si la imagen cambió y es de Supabase, eliminar la anterior
                const oldPath = getStoragePathFromUrl(productoOriginal.imagen);
                if (oldPath) {
                    await supabase.storage
                        .from(bucketName)
                        .remove([oldPath.replace(bucketName + '/', '')]);
                }
            }

            result = await supabase
                .from('productos')
                .update({ nombre, categoria_id, descripcion, precio, imagen })
                .eq('id', id);
        } else {
            result = await supabase
                .from('productos')
                .insert([{ nombre, categoria_id, descripcion, precio, imagen }]);
        }

        if (result.error) throw result.error;

        limpiarFormularioProducto();
        cargarProductos();
        mostrarMensaje('Producto guardado', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar', 'error');
    }
}

function editarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (producto) {
        document.getElementById('productoId').value = producto.id;
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoCategoria').value = producto.categoria_id;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
        document.getElementById('productoPrecio').value = producto.precio;
        document.getElementById('productoImagen').value = producto.imagen || '';

        const img = document.getElementById('imagePreview');
        if (producto.imagen) {
            img.src = producto.imagen;
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }
    }
}

async function eliminarProducto(id) {
    if (!confirm('¿Eliminar producto?')) return;

    try {
        // Buscar el producto para obtener la URL de la imagen
        const producto = productos.find(p => p.id === id);
        let imagenPath = null;
        if (producto && producto.imagen) {
            imagenPath = getStoragePathFromUrl(producto.imagen);
        }

        // Eliminar el producto de la base de datos
        const { error } = await supabase
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Eliminar la imagen del storage si existe y es de Supabase
        if (imagenPath) {
            const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([imagenPath.replace(bucketName + '/', '')]);
            if (storageError) {
                console.warn('No se pudo eliminar la imagen del storage:', storageError.message);
            }
        }

        cargarProductos();
        mostrarMensaje('Producto eliminado', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al eliminar', 'error');
    }
}

function limpiarFormularioProducto() {
    document.getElementById('productoForm').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('productoImagen').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${tipo}`;
    messageDiv.textContent = mensaje;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Event listeners
document.getElementById('categoriaForm').addEventListener('submit', guardarCategoria);
document.getElementById('productoForm').addEventListener('submit', guardarProducto);

// Restaurar la pestaña activa al cargar la página
window.addEventListener('DOMContentLoaded', function() {
    const tabGuardada = localStorage.getItem('tabActiva');
    if (tabGuardada && document.getElementById(tabGuardada)) {
        // Simula el click en la pestaña guardada
        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(tabGuardada)) {
                btn.click();
            }
        });
    }
});