let productos = [];
let productosFiltrados = [];
let productosDestacadosFiltrados = []; // Nueva variable para destacados filtrados
let carrito = {};
let cantidadesPrevias = {}; // Almacena la cantidad seleccionada en la tarjeta antes de agregar

// Configuración de Paginación
let paginaActual = 1;
const productosPorPagina = 8; // Puedes ajustar este número

// ID extraído directamente de la URL de tu Google Sheet
const SHEET_ID = '1pabikD9-VrMhUNVG4RVsiv332zRUqqbTnlNnKhhGbXY'; 

// Función auxiliar para leer una hoja específica
async function fetchHoja(nombreHoja, esDestacado) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${nombreHoja}`;
    const respuesta = await fetch(url);
    const texto = await respuesta.text();
    
    // Se limpia la envoltura de Google para obtener un JSON puro
    const jsonString = texto.substring(47).slice(0, -2);
    const datos = JSON.parse(jsonString);
    
    if (!datos.table || !datos.table.rows) return [];

    return datos.table.rows.map(fila => {
        if (!fila || !fila.c) return { id: null };
        
        // Estructura unificada (6 columnas: ID, Nombre, Precio, Stock, Categoria, IMG)
        return {
            id: fila.c[0] ? String(fila.c[0].v).trim() : null, // Convertimos a texto y limpiamos espacios
            nombre: fila.c[1] ? fila.c[1].v : 'Sin nombre',
            precio: fila.c[2] ? fila.c[2].v : 0,
            stock: (fila.c[3] && fila.c[3].v !== null) ? parseInt(fila.c[3].v) : 10, 
            categoria: (fila.c[4] && fila.c[4].v) ? fila.c[4].v : 'General', 
            img: (fila.c[5] && fila.c[5].v) ? fila.c[5].v : '',              
            isDestacado: esDestacado 
        };
    }).filter(prod => prod.id !== null && prod.id !== "null" && prod.id !== "");
}

// Función principal para obtener los datos de ambas pestañas
async function cargarProductos() {
    try {
        console.log("Cargando productos...");
        // Pedimos ambas hojas al mismo tiempo para mayor velocidad
        const [destacados, generales] = await Promise.all([
            fetchHoja('productos_dest', true),
            fetchHoja('productos_gral', false)
        ]);
        
        console.log("Productos cargados:", { destacados, generales });
        
        // Unimos todos los productos en un solo array. 
        productos = [...destacados, ...generales];
        
        // Poblamos las categorías ANTES del filtrado inicial
        poblarCategorias();
        
        // Inicialmente filtramos ambos para mostrar todo
        filtrarProductos(); 
    } catch (error) {
        console.error("Error detallado al cargar el stock:", error);
        document.getElementById('contenedor-productos').innerHTML = `
            <div class="col-12 text-center p-5">
                <p class="text-danger">Error al cargar el catálogo de productos.</p>
                <small class="text-muted">${error.message}</small>
            </div>`;
    }
}

// --- LÓGICA DE CATEGORÍAS Y FILTRADO ---

function poblarCategorias() {
    const selector = document.getElementById('select-categoria');
    if (!selector) return;
    
    // Obtenemos categorías de TODOS los productos (destacados y generales)
    const categoriasUnicas = [...new Set(productos.map(p => p.categoria))];
    
    selector.innerHTML = '<option value="todas">Todas las categorías</option>';
    categoriasUnicas.forEach(cat => {
        if (cat) {
            selector.innerHTML += `<option value="${cat}">${cat}</option>`;
        }
    });
}

function filtrarProductos() {
    const texto = document.getElementById('input-busqueda').value.toLowerCase().trim();
    const catSeleccionada = document.getElementById('select-categoria').value;
    
    // Filtramos TODOS los productos según la búsqueda y categoría
    const baseFiltrada = productos.filter(p => {
        const coincideTexto = p.nombre.toLowerCase().includes(texto);
        const coincideCat = (catSeleccionada === 'todas' || p.categoria === catSeleccionada);
        return coincideTexto && coincideCat;
    });

    // Separamos el resultado en destacados y generales para mantener el orden visual
    productosDestacadosFiltrados = baseFiltrada.filter(p => p.isDestacado);
    productosFiltrados = baseFiltrada.filter(p => !p.isDestacado);
    
    paginaActual = 1;
    renderizarProductos();
}

const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(precio);
};

// Renderizar las tarjetas de productos dinámicamente
function renderizarProductos() {
    const contenedorGral = document.getElementById('contenedor-productos');
    const contenedorDest = document.getElementById('contenedor-destacados');
    const tituloDest = document.querySelector('h2.m-0.border-start.border-warning'); // Título de destacados
    
    // Renderizado de Destacados
    if (contenedorDest) {
        contenedorDest.innerHTML = '';
        if (productosDestacadosFiltrados.length === 0) {
            // Si no hay destacados que coincidan, ocultamos el título y el contenedor
            if (tituloDest) tituloDest.parentElement.style.display = 'none';
            contenedorDest.style.display = 'none';
        } else {
            if (tituloDest) tituloDest.parentElement.style.display = 'flex';
            contenedorDest.style.display = 'flex';
            productosDestacadosFiltrados.forEach(prod => {
                const card = crearTarjetaProducto(prod);
                contenedorDest.appendChild(card);
            });
        }
    }

    // Renderizado de Catálogo General con Paginación
    contenedorGral.innerHTML = ''; 
    
    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    if (productosPagina.length === 0 && productosDestacadosFiltrados.length === 0) {
        contenedorGral.innerHTML = '<div class="col-12 text-center p-4 text-muted"><p>No se encontraron productos que coincidan con tu búsqueda.</p></div>';
    } else {
        productosPagina.forEach(prod => {
            const card = crearTarjetaProducto(prod);
            contenedorGral.appendChild(card);
        });
    }

    renderizarPaginacion();
}

function crearTarjetaProducto(prod) {
    const agotado = prod.stock <= 0;
    const card = document.createElement('div');
    const cantPrevia = cantidadesPrevias[prod.id] || 1;
    
    // Función para asignar colores según la categoría
    const obtenerColorCategoria = (cat) => {
        const colores = {
            'Bebidas': '#0d6efd',    // Azul
            'Almacén': '#fd7e14',    // Naranja
            'Lácteos': '#0dcaf0',    // Celeste
            'Fiambrería': '#dc3545', // Rojo
            'Infusiones': '#198754', // Verde
            'Panadería': '#ffc107',  // Amarillo/Dorado
            'Kiosco': '#6f42c1',     // Púrpura
            'Destacado': '#212529'   // Negro/Gris oscuro
        };
        return colores[cat] || '#6c757d'; // Gris por defecto
    };

    const colorBadge = obtenerColorCategoria(prod.categoria);
    const textoColor = (prod.categoria === 'Panadería') ? '#000' : '#fff'; // Texto negro en panadería para mejor contraste

    const badgeCategoria = `
        <span class="badge rounded-pill ms-1" style="font-size: 0.65rem; font-weight: bold; vertical-align: middle; background-color: ${colorBadge} !important; color: ${textoColor};">
            ${prod.categoria}
        </span>
    `;

    if (prod.isDestacado) {
        card.className = 'col-12 col-md-4'; 
        card.innerHTML = `
            <div class="card h-100 shadow border-warning border-2 position-relative">
                <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-warning text-dark border border-white px-3 py-2 shadow-sm">
                    <i class="bi bi-star-fill"></i> ¡Oferta Semanal!
                </span>
                <img src="${prod.img}" alt="${prod.nombre}" class="card-img-top p-2 rounded mt-2" style="height: 220px; object-fit: cover; background:#f8f9fa;">
                <div class="card-body p-3 d-flex flex-column text-center">
                    <h4 class="card-title fw-bold mb-1 text-dark">
                        ${prod.nombre}
                        ${badgeCategoria}
                    </h4>
                    <p class="text-success fw-bold fs-3 mb-2">${formatearPrecio(prod.precio)}</p>
                    <div class="mt-auto">
                        <small class="d-block mb-3 ${prod.stock < 5 ? 'text-danger fw-bold' : 'text-muted'}">
                            ${agotado ? '<i class="bi bi-exclamation-triangle"></i> Agotado por ahora' : `Stock disponible: ${prod.stock}`}
                        </small>
                        <button class="btn btn-warning btn-lg w-100 fw-bold shadow-sm" 
                            onclick="agregarAlCarrito(event, '${prod.id}')" 
                            ${agotado ? 'disabled' : ''}>
                            ${agotado ? 'Agotado' : '<i class="bi bi-cart-plus fs-5"></i> Lo Quiero'}
                        </button>
                        <!-- Selector de cantidad para destacados -->
                        <div class="d-flex align-items-center justify-content-center gap-3 mt-3 bg-light p-2 rounded-pill mx-auto" style="max-width: 140px; border: 1px solid #ffc107;">
                            <button class="btn btn-sm btn-link text-dark p-0" onclick="ajustarCantidadPrevia(event, '${prod.id}', -1)" ${agotado ? 'disabled' : ''}>
                                <i class="bi bi-dash-circle fs-4"></i>
                            </button>
                            <span class="fw-bold fs-5" style="min-width: 25px;" id="cant-previa-${prod.id}">${cantPrevia}</span>
                            <button class="btn btn-sm btn-link text-dark p-0" onclick="ajustarCantidadPrevia(event, '${prod.id}', 1)" ${agotado ? 'disabled' : ''}>
                                <i class="bi bi-plus-circle fs-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        card.className = 'col-6 col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card h-100 shadow-sm border-0 position-relative">
                <img src="${prod.img}" alt="${prod.nombre}" class="card-img-top p-2 rounded" style="height: 140px; object-fit: cover; background:#f8f9fa;">
                <div class="card-body p-2 d-flex flex-column">
                    <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">
                        ${prod.nombre}
                        ${badgeCategoria}
                    </h6>
                    <p class="text-success fw-bold mb-2">${formatearPrecio(prod.precio)}</p>
                    <div class="mt-auto">
                        <small class="d-block mb-2 ${prod.stock < 5 ? 'text-danger fw-bold' : 'text-muted'} " style="font-size: 0.75rem;">
                            ${agotado ? '<i class="bi bi-exclamation-triangle"></i> Sin Stock' : `Stock: ${prod.stock} disp.`}
                        </small>
                        <button class="btn btn-primary btn-sm w-100 fw-bold" 
                            onclick="agregarAlCarrito(event, '${prod.id}')" 
                            ${agotado ? 'disabled' : ''}>
                            ${agotado ? 'Agotado' : '<i class="bi bi-plus-lg"></i> Agregar'}
                        </button>
                        <!-- Selector de cantidad para catálogo general -->
                        <div class="d-flex align-items-center justify-content-center gap-2 mt-2 bg-light p-1 rounded-pill" style="border: 1px solid #0d6efd;">
                            <button class="btn btn-sm btn-link text-dark p-0" onclick="ajustarCantidadPrevia(event, '${prod.id}', -1)" ${agotado ? 'disabled' : ''}>
                                <i class="bi bi-dash-circle fs-5"></i>
                            </button>
                            <span class="fw-bold" style="min-width: 20px; font-size: 0.9rem;" id="cant-previa-${prod.id}">${cantPrevia}</span>
                            <button class="btn btn-sm btn-link text-dark p-0" onclick="ajustarCantidadPrevia(event, '${prod.id}', 1)" ${agotado ? 'disabled' : ''}>
                                <i class="bi bi-plus-circle fs-5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    return card;
}

function renderizarPaginacion() {
    const contenedor = document.getElementById('paginacion-container');
    if (!contenedor) return;

    const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
    
    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    let html = `
        <nav aria-label="Navegación de productos">
            <ul class="pagination pagination-sm m-0">
                <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
                    <a class="page-link" onclick="cambiarPagina(${paginaActual - 1})" aria-label="Anterior">
                        <span aria-hidden="true">&laquo;</span>
                    </a>
                </li>
    `;

    for (let i = 1; i <= totalPaginas; i++) {
        html += `
            <li class="page-item ${paginaActual === i ? 'active' : ''}">
                <a class="page-link" onclick="cambiarPagina(${i})">${i}</a>
            </li>
        `;
    }

    html += `
                <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
                    <a class="page-link" onclick="cambiarPagina(${paginaActual + 1})" aria-label="Siguiente">
                        <span aria-hidden="true">&raquo;</span>
                    </a>
                </li>
            </ul>
        </nav>
    `;

    contenedor.innerHTML = html;
}

function cambiarPagina(nuevaPagina) {
    const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    
    paginaActual = nuevaPagina;
    renderizarProductos();
    
    // Scroll suave hasta el catálogo
    const catalogo = document.getElementById('contenedor-productos');
    if (catalogo) {
        catalogo.scrollIntoView({ behavior: 'smooth' });
    }
}

// Función para mostrar alertas personalizadas usando el modal de Bootstrap
function mostrarAlerta(mensaje) {
    document.getElementById('alertModalMessage').innerText = mensaje;
    const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
    alertModal.show();
}

// Función para evitar el spam de clics en los botones
function pausarBoton(btn) {
    if (!btn) return;
    btn.disabled = true;
    setTimeout(() => {
        if (!btn.innerText.includes('Agotado')) {
            btn.disabled = false;
        }
    }, 400); 
}

function agregarAlCarrito(event, id) {
    const btn = event.currentTarget;
    pausarBoton(btn);

    const producto = productos.find(p => p.id == id);
    if (!producto || producto.stock <= 0) return;

    // Obtenemos la cantidad que el usuario seleccionó en la tarjeta
    const cantidadSeleccionada = cantidadesPrevias[id] || 1;

    if (producto.stock < cantidadSeleccionada) {
        mostrarAlerta(`Lo sentimos, solo quedan ${producto.stock} unidades de este producto.`);
        // Si hay stock pero menos de lo pedido, ajustamos a lo máximo posible
        cantidadesPrevias[id] = producto.stock;
        const spanCantidad = document.getElementById(`cant-previa-${id}`);
        if(spanCantidad) spanCantidad.innerText = producto.stock;
        return;
    }

    // Descontar stock inmediatamente
    producto.stock -= cantidadSeleccionada;

    if (carrito[id]) {
        carrito[id].cantidad += cantidadSeleccionada;
    } else {
        carrito[id] = { 
            nombre: producto.nombre, 
            precio: producto.precio, 
            cantidad: cantidadSeleccionada 
        };
    }
    
    // Resetear cantidad en la tarjeta después de agregar
    cantidadesPrevias[id] = 1;
    
    actualizarUI();
    renderizarProductos(); // Actualizar las tarjetas para mostrar el nuevo stock
}

function ajustarCantidadPrevia(event, id, delta) {
    if (event) event.stopPropagation();
    
    const producto = productos.find(p => p.id == id);
    if (!producto) return;

    if (!cantidadesPrevias[id]) cantidadesPrevias[id] = 1;
    
    let nuevaCantidad = cantidadesPrevias[id] + delta;

    // Validaciones
    if (nuevaCantidad < 1) nuevaCantidad = 1;
    if (nuevaCantidad > producto.stock) {
        mostrarAlerta("No puedes agregar más del stock disponible.");
        nuevaCantidad = producto.stock;
    }

    cantidadesPrevias[id] = nuevaCantidad;
    
    // Actualizar solo el número en el DOM para no re-renderizar todo
    const spanCantidad = document.getElementById(`cant-previa-${id}`);
    if (spanCantidad) {
        spanCantidad.innerText = nuevaCantidad;
    }
}

function cambiarCantidad(event, id, delta) {
    const btn = event.currentTarget;
    pausarBoton(btn);

    const producto = productos.find(p => p.id == id);
    if (!carrito[id]) return;

    if (delta > 0) {
        // Incrementar cantidad en carrito (descontar stock)
        if (producto.stock > 0) {
            carrito[id].cantidad += 1;
            producto.stock -= 1;
        } else {
            mostrarAlerta("No hay más stock disponible para este producto.");
            return;
        }
    } else {
        // Reducir cantidad en carrito (devolver stock)
        carrito[id].cantidad -= 1;
        producto.stock += 1;
        
        if (carrito[id].cantidad <= 0) {
            delete carrito[id];
        }
    }
    
    actualizarUI();
    renderizarProductos(); // Actualizar las tarjetas
}

function actualizarUI() {
    let total = 0;
    let itemsTotales = 0;
    const itemsContenedor = document.getElementById('items-contenedor-modal');
    const modalVacio = document.getElementById('carrito-vacio');
    const modalLista = document.getElementById('lista-carrito');
    const badge = document.getElementById('cart-badge');
    const badgeFlotante = document.getElementById('cart-badge-flotante');
    
    itemsContenedor.innerHTML = '';

    for (const id in carrito) {
        const item = carrito[id];
        total += item.precio * item.cantidad;
        itemsTotales += item.cantidad;

        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded';
        div.innerHTML = `
            <div style="flex: 1;">
                <div class="fw-bold small text-truncate" style="max-width: 150px;">${item.nombre}</div>
                <div class="text-muted small">${formatearPrecio(item.precio * item.cantidad)}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="cambiarCantidad(event, '${id}', -1)">-</button>
                <span class="fw-bold mx-1">${item.cantidad}</span>
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="cambiarCantidad(event, '${id}', 1)">+</button>
            </div>
        `;
        itemsContenedor.appendChild(div);
    }

    const totalStr = formatearPrecio(total);
    document.getElementById('total-precio').innerText = totalStr;
    document.getElementById('total-precio-modal').innerText = totalStr;
    
    if (itemsTotales > 0) {
        badge.innerText = itemsTotales;
        badge.classList.remove('d-none');
        badgeFlotante.innerText = itemsTotales;
        badgeFlotante.classList.remove('d-none');
        modalVacio.classList.add('d-none');
        modalLista.classList.remove('d-none');
        document.getElementById('btn-finalizar-pedido').disabled = false;
    } else {
        badge.classList.add('d-none');
        badgeFlotante.classList.add('d-none');
        modalVacio.classList.remove('d-none');
        modalLista.classList.add('d-none');
        document.getElementById('btn-finalizar-pedido').disabled = true;
    }
}

// Lógica para el botón flotante del carrito
window.addEventListener('scroll', () => {
    const btnFlotante = document.getElementById('btn-flotante-carrito');
    const cartBadge = document.getElementById('cart-badge');
    
    if (!btnFlotante || !cartBadge) return;

    // Obtener la posición del botón de carrito principal
    const rect = cartBadge.getBoundingClientRect();
    
    // Si el botón principal (su badge) no es visible (scrolleado hacia arriba)
    if (rect.bottom < 0) {
        btnFlotante.classList.remove('d-none');
        btnFlotante.classList.add('animate__animated', 'animate__fadeInRight');
    } else {
        btnFlotante.classList.add('d-none');
    }
});

function enviarPedido(e) {
    if (e) e.preventDefault();
    
    let texto = "¡Hola *Despensa Ramiro*! Quiero hacer el siguiente pedido:\n\n";
    let tieneProductos = false;

    for (const id in carrito) {
        const item = carrito[id];
        texto += `• *${item.cantidad}x* ${item.nombre} (${formatearPrecio(item.precio * item.cantidad)})\n`;
        tieneProductos = true;
    }

    if (!tieneProductos) return;

    texto += `\n*Total Estimado: ${document.getElementById('total-precio-modal').innerText}*`;
    texto += `\n\n_Por favor, confirmen mi pedido y coordinamos el retiro/envío._`;
    
    const numeroTelefono = "5493884340480"; 
    const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(texto)}`;
    
    window.open(urlWhatsapp, '_blank');

    carrito = {};
    actualizarUI();
    renderizarProductos(); 
    
    
    const modalElement = document.getElementById('cartModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
}

cargarProductos();