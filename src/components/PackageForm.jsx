// src/components/PackageForm.js
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import Quagga from 'quagga'
import 'jspdf-autotable'

export default function PackageForm({ package: pkg, products, onUpdate }) {
  const [scannedCode, setScannedCode] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualProduct, setManualProduct] = useState({
    barcode: '',
    name: ''
  })
  const inputRef = useRef(null)

  // Optimización: Crear un mapa de productos para búsquedas O(1)
  const productMap = useMemo(() => {
    console.log('Creando mapa de productos para una búsqueda rápida...');
    return products.reduce((map, product) => {
      map[product.barcode] = product;
      return map;
    }, {});
  }, [products]);

  useEffect(() => {
    if (inputRef.current && !showManualForm) {
      inputRef.current.focus()
    }
  }, [showManualForm])

  const handleScan = (e) => {
    const code = e.target.value
    setScannedCode(code)

    if (e.key === 'Enter' && code.trim()) {
      processScannedCode(code)
      setScannedCode('')
    }
  }

  const processScannedCode = (code) => {
    // Buscar el producto en el mapa para un acceso rápido
    const product = productMap[code];

    if (!product) {
      setMessage('Producto no encontrado. Puede agregarlo manualmente.');
      setMessageType('warning');
      setTimeout(() => setMessage(''), 3000);

      // Pre-llenar el código de barras en el formulario manual
      setManualProduct({
        barcode: code,
        name: ''
      });
      setShowManualForm(true);
      return;
    }

    // Lógica para sumar cantidad si el producto ya existe en el paquete
    const currentItems = [...pkg.items];
    const existingItemIndex = currentItems.findIndex(item => item.barcode === code);

    if (existingItemIndex >= 0) {
      // Si el producto ya existe, incrementa su cantidad
      currentItems[existingItemIndex].quantity += 1;
      setMessage(`Cantidad incrementada: ${product.name}`);
    } else {
      // Si es un producto nuevo, lo agrega al paquete con cantidad 1
      currentItems.push({
        ...product,
        quantity: 1,
        manual: false
      });
      setMessage(`Producto agregado: ${product.name}`);
    }

    setMessageType('success');
    onUpdate(pkg.id, currentItems);
    setTimeout(() => setMessage(''), 3000);
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()

    if (!manualProduct.barcode || !manualProduct.name) {
      setMessage('Por favor complete todos los campos obligatorios')
      setMessageType('danger')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // 💡 Lógica para sumar cantidad si el producto ya existe en el paquete
    const currentItems = [...pkg.items]
    const existingItemIndex = currentItems.findIndex(item => item.barcode === manualProduct.barcode)

    if (existingItemIndex >= 0) {
      // Si el producto ya existe, incrementa su cantidad
      currentItems[existingItemIndex].quantity += 1
      setMessage(`Cantidad incrementada: ${manualProduct.name}`)
    } else {
      // Si es un producto nuevo, lo agrega al paquete con cantidad 1
      currentItems.push({
        ...manualProduct,
        quantity: 1,
        id: Date.now(), // ID temporal para productos manuales
        manual: true
      })
      setMessage(`Producto agregado: ${manualProduct.name}`)
    }

    setMessageType('success')
    onUpdate(pkg.id, currentItems)

    // Guardar producto manual en el JSON (simulado)
    saveManualProductToJSON(manualProduct)

    // Resetear formulario
    setManualProduct({
      barcode: '',
      name: ''
    })
    setShowManualForm(false)
    setTimeout(() => setMessage(''), 3000)
  }

  // Función simulada para guardar en JSON
  const saveManualProductToJSON = (product) => {
    // En una aplicación real, aquí harías una llamada a una API
    // o actualizarías el estado global para persistir el producto
    console.log('Producto manual guardado:', {
      ...product,
      id: Date.now(),
      manual: true
    })

    // Mostrar mensaje de confirmación
    setMessage(`Producto "${product.name}" guardado en el sistema`)
    setMessageType('success')
    setTimeout(() => setMessage(''), 3000)
  }

  const removeItem = (barcode) => {
    const updatedItems = pkg.items.filter(item => item.barcode !== barcode)
    onUpdate(pkg.id, updatedItems)
  }

  const adjustQuantity = (barcode, adjustment) => {
    const updatedItems = pkg.items.map(item => {
      if (item.barcode === barcode) {
        const newQuantity = item.quantity + adjustment
        return { ...item, quantity: newQuantity >= 1 ? newQuantity : 1 }
      }
      return item
    })
    onUpdate(pkg.id, updatedItems)
  }

  const generateExcel = () => {
    // Crear workbook
    const wb = XLSX.utils.book_new()

    // Crear hoja COMPRAS con el formato específico
    const comprasData = [
      ['ID_PAQUETE', 'CODIGO_BARRAS', 'NOMBRE_PRODUCTO', 'CANTIDAD', 'OBSERVACIONES'],
      ...pkg.items.map(item => [
        pkg.id,
        item.barcode,
        item.name,
        item.quantity,
        item.manual ? 'Ingreso Manual' : ''
      ])
    ]

    const comprasWs = XLSX.utils.aoa_to_sheet(comprasData)
    XLSX.utils.book_append_sheet(wb, comprasWs, 'COMPRAS')

    // Descargar archivo
    XLSX.writeFile(wb, `COMPRAS_${pkg.id}_${new Date().toISOString().split('T')[0]}.xls`)
  }

  const generatePDF = () => {
    try {
      // Crear nuevo documento PDF
      const doc = new jsPDF()

      // Título
      doc.setFontSize(18)
      doc.text('LISTA DE PRODUCTOS - PAQUETE', 105, 15, { align: 'center' })

      // Información del paquete
      doc.setFontSize(12)
      doc.text(`ID del Paquete: ${pkg.id}`, 14, 25)
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 32)
      doc.text(`Total de items: ${totalItems}`, 14, 39)

      // Preparar datos para la tabla
      const tableData = pkg.items.map(item => [
        item.barcode,
        item.name,
        item.quantity.toString(),
        item.manual ? 'Ingreso Manual' : ''
      ])

      // Verificar que autoTable esté disponible
      if (typeof doc.autoTable !== 'function') {
        throw new Error('La función autoTable no está disponible')
      }

      // Crear tabla
      doc.autoTable({
        startY: 45,
        head: [['Código', 'Producto', 'Cantidad', 'Observaciones']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      })

      // Guardar PDF
      doc.save(`lista_paquete_${pkg.id}.pdf`)
    } catch (error) {
      console.error('Error al generar PDF:', error)
      setMessage('Error al generar el PDF. Verifica la consola para más detalles.')
      setMessageType('danger')
      setTimeout(() => setMessage(''), 5000)
    }
  }

  // Función alternativa para generar PDF sin autoTable
  const generatePDFAlternative = () => {
    try {
      // Crear nuevo documento PDF
      const doc = new jsPDF()

      // Título
      doc.setFontSize(18)
      doc.text('LISTA DE PRODUCTOS - PAQUETE', 105, 15, { align: 'center' })

      // Información del paquete
      doc.setFontSize(12)
      doc.text(`ID del Paquete: ${pkg.id}`, 14, 25)
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 32)
      doc.text(`Total de items: ${totalItems}`, 14, 39)

      // Encabezados de tabla
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Código', 15, 50)
      doc.text('Producto', 55, 50)
      doc.text('Cantidad', 135, 50)
      doc.text('Observaciones', 165, 50)

      // Línea separadora
      doc.line(14, 52, 196, 52)

      // Contenido de la tabla
      doc.setFont(undefined, 'normal')
      let yPosition = 60

      pkg.items.forEach((item, index) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }

        doc.text(item.barcode, 15, yPosition)
        doc.text(item.name, 55, yPosition)
        doc.text(item.quantity.toString(), 135, yPosition)
        doc.text(item.manual ? 'Ingreso Manual' : '', 165, yPosition)

        yPosition += 10
      })

      // Guardar PDF
      doc.save(`lista_paquete_${pkg.id}.pdf`)
    } catch (error) {
      console.error('Error al generar PDF alternativo:', error)
      setMessage('Error al generar el PDF.')
      setMessageType('danger')
      setTimeout(() => setMessage(''), 5000)
    }
  }

  const startBarcodeScanner = () => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: document.querySelector('#reader'), // Contenedor para la cámara
          constraints: {
            facingMode: 'environment', // Usar la cámara trasera
          },
        },
        decoder: {
          readers: ['code_128_reader', 'ean_reader', 'ean_8_reader'], // Tipos de códigos de barras soportados
        },
      },
      (err) => {
        if (err) {
          console.error('Error al iniciar Quagga:', err);
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      processScannedCode(code);
      Quagga.stop(); // Detener el escáner después de leer un código
    });
  };

  const totalItems = pkg.items.reduce((total, item) => total + item.quantity, 0)

  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">Escaneando Paquete: {pkg.id}</h5>
      </div>
      <div className="card-body">
        {message && (
          <div className={`alert alert-${messageType} alert-dismissible fade show`} role="alert">
            {message}
            <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
          </div>
        )}

        {!showManualForm ? (
          <>
            <div className="mb-4">
              <label htmlFor="barcodeInput" className="form-label">Escáner de código de barras</label>
              <input
                ref={inputRef}
                id="barcodeInput"
                type="text"
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                onKeyPress={handleScan}
                placeholder="Pase el código de barras por el lector y presione Enter"
                className="form-control form-control-lg"
              />
              <div className="form-text">Simula un lector de código de barras ingresando el código manualmente</div>
            </div>

            <div className="d-grid gap-2">
              <button
                className="btn btn-outline-primary"
                onClick={startBarcodeScanner}
              >
                <i className="bi bi-camera-video me-2"></i>Escanear código de barras
              </button>
            </div>

            <div id="reader" style={{ width: '100%', height: '300px' }}></div>
          </>
        ) : (
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">Agregar Producto Manualmente</h6>
            </div>
            <div className="card-body">
              <form onSubmit={handleManualSubmit}>
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="barcode" className="form-label">Código de Barras *</label>
                      <input
                        type="text"
                        className="form-control"
                        id="barcode"
                        value={manualProduct.barcode}
                        onChange={(e) => setManualProduct({ ...manualProduct, barcode: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="name" className="form-label">Nombre del Producto *</label>
                      <input
                        type="text"
                        className="form-control"
                        id="name"
                        value={manualProduct.name}
                        onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success">
                    <i className="bi bi-check-circle me-2"></i>Agregar Producto
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowManualForm(false)
                      setManualProduct({ barcode: '', name: '' })
                    }}
                  >
                    <i className="bi bi-x-circle me-2"></i>Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5>Productos en el paquete</h5>
          <span className="badge bg-primary">{totalItems} items total</span>
        </div>

        {pkg.items.length === 0 ? (
          <div className="text-center py-4">
            <i className="bi bi-upc-scan display-4 text-muted"></i>
            <p className="mt-3 text-muted">No hay productos escaneados aún. Comienza a escanear productos.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Observaciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pkg.items.map((item, index) => (
                  <tr key={index}>
                    <td className="font-monospace">{item.barcode}</td>
                    <td>{item.name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => adjustQuantity(item.barcode, -1)}
                        >
                          -
                        </button>
                        <span className="mx-2">{item.quantity}</span>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => adjustQuantity(item.barcode, 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>
                      {item.manual && (
                        <span className="badge bg-warning text-dark">
                          <i className="bi bi-pencil-square me-1"></i>Ingreso Manual
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeItem(item.barcode)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pkg.items.length > 0 && (
          <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
            <button onClick={generatePDFAlternative} className="btn btn-danger me-2">
              <i className="bi bi-file-earmark-pdf me-2"></i>Generar PDF
            </button>
            <button onClick={generateExcel} className="btn btn-success">
              <i className="bi bi-file-earmark-excel me-2"></i>Generar Excel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
