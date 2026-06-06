let productos = [];
let carrito = {};

// ID extraído directamente de la URL de tu Google Sheet
const SHEET_ID = '1pabikD9-VrMhUNVG4RVsiv332zRUqqbTnlNnKhhGbXY'; 
const URL_GOOGLE_SHEET = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

// Función principal para obtener los datos de la planilla
async function cargarProductos() {
    try {
        const respuesta = await fetch(URL_GOOGLE_SHEET);
        const texto = await respuesta.text();
        
        // Se limpia la envoltura de Google para obtener un JSON puro
        const jsonString = texto.substring(47).slice(0, -2);
        const datos = JSON.parse(jsonString);
        
        // Mapeo de las filas al formato de objeto necesario para el carrito
        // Asumimos: col 0=ID, col 1=Nombre, col 2=Precio, col 3=IMG, col 4=Stock (opcional)
        productos = datos.table.rows.map(fila => {
            return {
                id: fila.c[0] ? fila.c[0].v : null,
                nombre: fila.c[1] ? fila.c[1].v : 'Sin nombre',
                precio: fila.c[2] ? fila.c[2].v : 0,
                stock: (fila.c[3] && fila.c[3].v !== null) ? parseInt(fila.c[3].v) : 10, 
     
                img: fila.c[4] ? fila.c[4].v : '' 
            };
        }).filter(prod => prod.id !== null);

        renderizarProductos();
    } catch (error) {
        console.error("Error al cargar el stock de Despensa Ramiro:", error);
        document.getElementById('contenedor-productos').innerHTML = '<div class="col-12 text-center p-5"><p class="text-danger">Error al cargar el catálogo de productos.</p></div>';
    }
}

const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(precio);
};

// Renderizar las tarjetas de productos dinámicamente con Bootstrap
function renderizarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = ''; 
    
    productos.forEach(prod => {
        const agotado = prod.stock <= 0;
        const card = document.createElement('div');
        card.className = 'col-6 col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card h-100 shadow-sm border-0 position-relative">
                <img src="${prod.img}" alt="${prod.nombre}" class="card-img-top p-2 rounded" style="height: 140px; object-fit: cover; background:#f8f9fa;">
                <div class="card-body p-2 d-flex flex-column">
                    <h6 class="card-title fw-bold mb-1 fw-bold" style="font-size: 0.9rem;">${prod.nombre}</h6>
                    <p class="text-success fw-bold mb-2">${formatearPrecio(prod.precio)}</p>
                    <div class="mt-auto">
                        <small class="d-block mb-2 ${prod.stock < 5 ? 'text-danger fw-bold' : 'text-muted'} " style="font-size: 0.75rem;">
                            ${agotado ? '<i class="bi bi-exclamation-triangle"></i> Sin Stock' : `Stock: ${prod.stock} disp.`}
                        </small>
                        <button class="btn btn-primary btn-sm w-100 fw-bold" 
                            onclick="agregarAlCarrito(event, ${prod.id})" 
                            ${agotado ? 'disabled' : ''}>
                            ${agotado ? 'Agotado' : '<i class="bi bi-plus-lg"></i> Agregar'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
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
        // Solo rehabilitar si no es un botón de "Agotado" (basado en el texto o contexto)
        if (!btn.innerText.includes('Agotado')) {
            btn.disabled = false;
        }
    }, 400); // Pausa de 400ms
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
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="cambiarCantidad(event, ${id}, -1)">-</button>
                <span class="fw-bold mx-1">${item.cantidad}</span>
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="cambiarCantidad(event, ${id}, 1)">+</button>
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
        
        // Simular descuento de stock
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