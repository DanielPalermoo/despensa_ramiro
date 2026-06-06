let productos = [];
let carrito = {};

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
    
    return datos.table.rows.map(fila => {
        return {
            id: fila.c[0] ? fila.c[0].v : null,
            nombre: fila.c[1] ? fila.c[1].v : 'Sin nombre',
            precio: fila.c[2] ? fila.c[2].v : 0,
            stock: (fila.c[3] && fila.c[3].v !== null) ? parseInt(fila.c[3].v) : 10, 
            img: fila.c[4] ? fila.c[4].v : '',
            isDestacado: esDestacado // Bandera para saber cómo renderizarlo
        };
    }).filter(prod => prod.id !== null);
}

// Función principal para obtener los datos de ambas pestañas
async function cargarProductos() {
    try {
        // Pedimos ambas hojas al mismo tiempo para mayor velocidad
        const [destacados, generales] = await Promise.all([
            fetchHoja('productos_dest', true),
            fetchHoja('productos_gral', false)
        ]);
        
        // Unimos todos los productos en un solo array. 
        // ¡Esto mantiene tu lógica de carrito funcionando a la perfección!
        productos = [...destacados, ...generales];
        
        renderizarProductos();
    } catch (error) {
        console.error("Error al cargar el stock de Despensa Ramiro:", error);
        document.getElementById('contenedor-productos').innerHTML = '<div class="col-12 text-center p-5"><p class="text-danger">Error al cargar el catálogo de productos.</p></div>';
    }
}

const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(precio);
};

// Renderizar las tarjetas de productos dinámicamente
function renderizarProductos() {
    const contenedorGral = document.getElementById('contenedor-productos');
    const contenedorDest = document.getElementById('contenedor-destacados');
    
    contenedorGral.innerHTML = ''; 
    if (contenedorDest) contenedorDest.innerHTML = '';
    
    productos.forEach(prod => {
        const agotado = prod.stock <= 0;
        const card = document.createElement('div');
        
        if (prod.isDestacado) {
            // ESTILOS PARA PRODUCTOS DESTACADOS (Más grandes y llamativos)
            card.className = 'col-12 col-md-4'; // 3 por fila en desktop, ocupan todo el ancho en mobile
            card.innerHTML = `
                <div class="card h-100 shadow border-warning border-2 position-relative">
                    <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-warning text-dark border border-white px-3 py-2 shadow-sm">
                        <i class="bi bi-star-fill"></i> ¡Oferta Semanal!
                    </span>
                    <img src="${prod.img}" alt="${prod.nombre}" class="card-img-top p-2 rounded mt-2" style="height: 220px; object-fit: cover; background:#f8f9fa;">
                    <div class="card-body p-3 d-flex flex-column text-center">
                        <h4 class="card-title fw-bold mb-1 text-dark">${prod.nombre}</h4>
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
                        </div>
                    </div>
                </div>
            `;
            if (contenedorDest) contenedorDest.appendChild(card);
        } else {
            // ESTILOS PARA CATÁLOGO GENERAL (Tu diseño original conservado)
            card.className = 'col-6 col-md-4 col-lg-3';
            card.innerHTML = `
                <div class="card h-100 shadow-sm border-0 position-relative">
                    <img src="${prod.img}" alt="${prod.nombre}" class="card-img-top p-2 rounded" style="height: 140px; object-fit: cover; background:#f8f9fa;">
                    <div class="card-body p-2 d-flex flex-column">
                        <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">${prod.nombre}</h6>
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
                        </div>
                    </div>
                </div>
            `;
            contenedorGral.appendChild(card);
        }
    });
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

    if (carrito[id]) {
        if (carrito[id].cantidad < producto.stock) {
            carrito[id].cantidad += 1;
        } else {
            mostrarAlerta("Has alcanzado el límite de stock disponible para este producto.");
            return;
        }
    } else {
        carrito[id] = { 
            nombre: producto.nombre, 
            precio: producto.precio, 
            cantidad: 1 
        };
    }
    actualizarUI();
}

function cambiarCantidad(event, id, delta) {
    const btn = event.currentTarget;
    pausarBoton(btn);

    const producto = productos.find(p => p.id == id);
    if (!carrito[id]) return;

    if (delta > 0) {
        if (carrito[id].cantidad < producto.stock) {
            carrito[id].cantidad += 1;
        } else {
            mostrarAlerta("No hay más stock disponible para este producto.");
        }
    } else {
        carrito[id].cantidad -= 1;
        if (carrito[id].cantidad <= 0) {
            delete carrito[id];
        }
    }
    actualizarUI();
}

function actualizarUI() {
    let total = 0;
    let itemsTotales = 0;
    const itemsContenedor = document.getElementById('items-contenedor-modal');
    const modalVacio = document.getElementById('carrito-vacio');
    const modalLista = document.getElementById('lista-carrito');
    const badge = document.getElementById('cart-badge');
    
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
        modalVacio.classList.add('d-none');
        modalLista.classList.remove('d-none');
        document.getElementById('btn-finalizar-pedido').disabled = false;
    } else {
        badge.classList.add('d-none');
        modalVacio.classList.remove('d-none');
        modalLista.classList.add('d-none');
        document.getElementById('btn-finalizar-pedido').disabled = true;
    }
}

function enviarPedido(e) {
    if (e) e.preventDefault();
    
    let texto = "¡Hola *Despensa Ramiro*! Quiero hacer el siguiente pedido:\n\n";
    let tieneProductos = false;

    for (const id in carrito) {
        const item = carrito[id];
        texto += `• *${item.cantidad}x* ${item.nombre} (${formatearPrecio(item.precio * item.cantidad)})\n`;
        
        // Simular descuento de stock en UI
        const productoIndex = productos.findIndex(p => p.id == id);
        if (productoIndex !== -1) {
            productos[productoIndex].stock -= item.cantidad;
        }
        
        tieneProductos = true;
    }

    if (!tieneProductos) return;

    texto += `\n*Total Estimado: ${document.getElementById('total-precio-modal').innerText}*`;
    texto += `\n\n_Por favor, confirmen mi pedido y coordinamos el retiro/envío._`;
    
    // Nro de Ramiro
    const numeroTelefono = "5493884340480"; 
    const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(texto)}`;
    
    window.open(urlWhatsapp, '_blank');

    carrito = {};
    actualizarUI();
    renderizarProductos(); 
    
    // Cerrar modal
    const modalElement = document.getElementById('cartModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
}

// Iniciar carga
cargarProductos();