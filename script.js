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
        productos = datos.table.rows.map(fila => {
            return {
                id: fila.c[0] ? fila.c[0].v : null,
                nombre: fila.c[1] ? fila.c[1].v : 'Sin nombre',
                precio: fila.c[2] ? fila.c[2].v : 0,
                img: fila.c[3] ? fila.c[3].v : ''
            };
        }).filter(prod => prod.id !== null); // Se descartan filas que no tengan ID

        // Renderizado de los productos en la interfaz
        renderizarProductos();
    } catch (error) {
        console.error("Error al cargar el stock de Despensa Ramiro:", error);
        document.getElementById('contenedor-productos').innerHTML = '<p>Error al cargar el catálogo de productos.</p>';
    }
}

// Función para formatear moneda a ARS
const formatearPrecio = (precio) => {
    return `ARS $${precio.toFixed(2)}`;
};

// Renderizar las tarjetas de productos dinámicamente
function renderizarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = ''; 
    
    productos.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'producto-card';
        card.innerHTML = `
            <img src="${prod.img}" alt="${prod.nombre}" class="img-producto producto-img">
            <div class="producto-nombre">${prod.nombre}</div>
            <div class="producto-precio">${formatearPrecio(prod.precio)}</div>
            <button class="btn-agregar" onclick="agregarAlCarrito(${prod.id}, '${prod.nombre}', ${prod.precio})">
                <i class="fa-solid fa-plus"></i> Agregar al Pedido
            </button>
        `;
        contenedor.appendChild(card);
    });
}

function agregarAlCarrito(id, nombre, precio) {
    if (carrito[id]) {
        carrito[id].cantidad += 1;
    } else {
        carrito[id] = { nombre: nombre, precio: precio, cantidad: 1 };
    }
    actualizarTotal();
}

function actualizarTotal() {
    let total = 0;
    for (const id in carrito) {
        total += carrito[id].precio * carrito[id].cantidad;
    }
    document.getElementById('total-precio').innerText = formatearPrecio(total);
}

function enviarPedido(e) {
    e.preventDefault();
    
    let texto = "¡Hola *Despensa Ramiro*! Quiero hacer el siguiente pedido:\n\n";
    let tieneProductos = false;

    for (const id in carrito) {
        texto += `-${carrito[id].cantidad}x ${carrito[id].nombre} ($${carrito[id].precio * carrito[id].cantidad})\n`;
        tieneProductos = true;
    }

    if (!tieneProductos) {
        alert("Por favor, agrega al menos un producto al carrito antes de pedir.");
        return;
    }

    texto += `\n*Total Estimado: ${document.getElementById('total-precio').innerText}*`;
    texto += `\n\n_Por favor, confirmen mi pedido y coordinamos el retiro/envío._`;
    
    const numeroTelefono = "5493884340480"; 
    const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(texto)}`;
    
    window.open(urlWhatsapp, '_blank');
}

// Inicialización de la carga al abrir la página
cargarProductos();