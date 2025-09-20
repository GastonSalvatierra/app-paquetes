'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import Quagga from 'quagga'

export default function PackageForm({ package: pkg, products, onUpdate }) {
  const [scannedCode, setScannedCode] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualProduct, setManualProduct] = useState({ barcode: '', name: '' })

  const [responsible, setResponsible] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [isPsychotropic, setIsPsychotropic] = useState(false)

  const inputRef = useRef(null)

  const productMap = useMemo(() => {
    return products.reduce((map, product) => {
      map[product.barcode] = product
      return map
    }, {})
  }, [products])

  useEffect(() => {
    if (inputRef.current && !showManualForm) {
      inputRef.current.focus()
    }
  }, [showManualForm])

  const processCode = (code, isManual = false) => {
    const product = productMap[code]
    const currentItems = [...pkg.items]
    const existingItemIndex = currentItems.findIndex(item => item.barcode === code)

    if (!product && !isManual) {
      setMessage('Producto no encontrado. Puede agregarlo manualmente.')
      setMessageType('warning')
      setManualProduct({ barcode: code, name: '' })
      setShowManualForm(true)
      return
    }

    if (existingItemIndex >= 0) {
      currentItems[existingItemIndex].quantity += 1
      setMessage(`Cantidad incrementada: ${product?.name || manualProduct.name}`)
    } else {
      currentItems.push({
        ...(product || manualProduct),
        quantity: 1,
        manual: isManual
      })
      setMessage(`Producto agregado: ${product?.name || manualProduct.name}`)
    }

    setMessageType('success')
    onUpdate(pkg.id, currentItems)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleScan = (e) => {
    const code = e.target.value
    setScannedCode(code)
    if (e.key === 'Enter' && code.trim()) {
      processCode(code)
      setScannedCode('')
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    const { barcode, name } = manualProduct

    if (!barcode || !name) {
      setMessage('Por favor complete todos los campos obligatorios')
      setMessageType('danger')
      return
    }

    const currentItems = [...pkg.items]
    const existingItemIndex = currentItems.findIndex(item => item.barcode === barcode)

    if (existingItemIndex >= 0) {
      currentItems[existingItemIndex].quantity += 1
      setMessage(`Cantidad incrementada: ${name}`)
    } else {
      currentItems.push({
        ...manualProduct,
        quantity: 1,
        id: Date.now(),
        manual: true
      })
      setMessage(`Producto agregado: ${name}`)
      saveManualProductToJSON(manualProduct)
    }

    setMessageType('success')
    onUpdate(pkg.id, currentItems)
    setManualProduct({ barcode: '', name: '' })
    setShowManualForm(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const saveManualProductToJSON = (product) => {
    console.log('Producto manual guardado:', {
      ...product,
      id: Date.now(),
      manual: true
    })
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
    const wb = XLSX.utils.book_new()
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
    XLSX.writeFile(wb, `COMPRAS_${pkg.id}_${new Date().toISOString().split('T')[0]}.xls`)
  }

  // ✅ Función para generar PDF usando window.print() con estilos optimizados
  const generatePDF = () => {
    // Crear un elemento iframe para la impresión
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const printDocument = iframe.contentWindow.document;
    
    // Escribir el contenido HTML para imprimir
    printDocument.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lista de Paquete ${pkg.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #345;
              padding-bottom: 10px;
            }
            .header h1 {
              color: #345;
              margin: 0;
            }
            .info-section {
              margin-bottom: 15px;
            }
            .info-section div {
              margin-bottom: 5px;
            }
            .product-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .product-table th {
              background-color: #345;
              color: white;
              padding: 10px;
              text-align: left;
            }
            .product-table td {
              padding: 8px 10px;
              border-bottom: 1px solid #ddd;
            }
            .product-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #777;
            }
            @media print {
              body {
                margin: 0;
                padding: 15px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LISTA DE PRODUCTOS - PAQUETE</h1>
          </div>
          
          <div class="info-section">
            <div><strong>ID del Paquete:</strong> ${pkg.id}</div>
            <div><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</div>
            <div><strong>Total de items:</strong> ${totalItems}</div>
            ${responsible ? `<div><strong>Responsable:</strong> ${responsible}</div>` : ''}
            ${laboratory ? `<div><strong>Laboratorio:</strong> ${laboratory}</div>` : ''}
            ${isPsychotropic ? `<div><strong>Tipo:</strong> Psicofármaco</div>` : ''}
          </div>
          
          <table class="product-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${normalizedItems.map(item => `
                <tr>
                  <td>${item.barcode}</td>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.manual ? 'Ingreso Manual' : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Documento generado el ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);
    
    printDocument.close();
    
    // Esperar a que el iframe cargue completamente antes de imprimir
    iframe.onload = function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      // Eliminar el iframe después de imprimir
      document.body.removeChild(iframe);
    };
  }

  const startBarcodeScanner = () => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: document.querySelector('#reader'),
          constraints: {
            facingMode: 'environment'
          }
        },
        decoder: {
          readers: ['code_128_reader', 'ean_reader', 'ean_8_reader']
        }
      },
      (err) => {
        if (err) {
          console.error('Error al iniciar Quagga:', err)
          return
        }
        Quagga.start()
      }
    )
    Quagga.onDetected((data) => {
      const code = data.codeResult.code
      processCode(code)
      Quagga.stop()
    })
  }

  const totalItems = pkg.items.reduce((total, item) => total + item.quantity, 0)

  const normalizedItems = Object.values(
    pkg.items.reduce((acc, item) => {
      if (!acc[item.barcode]) {
        acc[item.barcode] = { ...item }
      } else {
        acc[item.barcode].quantity += item.quantity
      }
      return acc
    }, {})
  )

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

        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">Información del Rótulo</h6>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="responsible" className="form-label">Nombre del Responsable</label>
                <input
                  type="text"
                  className="form-control"
                  id="responsible"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="laboratory" className="form-label">Laboratorio</label>
                <input
                  type="text"
                  className="form-control"
                  id="laboratory"
                  value={laboratory}
                  onChange={(e) => setLaboratory(e.target.value)}
                />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isPsychotropic"
                    checked={isPsychotropic}
                    onChange={(e) => setIsPsychotropic(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="isPsychotropic">
                    Es Psicofármaco
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

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
              <button className="btn btn-outline-primary" onClick={startBarcodeScanner}>
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
                  <button type="button" className="btn btn-secondary" onClick={() => {
                      setShowManualForm(false)
                      setManualProduct({ barcode: '', name: '' })
                    }}>
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

        {normalizedItems.length === 0 ? (
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
                {normalizedItems.map((item) => (
                  <tr key={item.barcode}>
                    <td className="font-monospace">{item.barcode}</td>
                    <td>{item.name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => adjustQuantity(item.barcode, -1)}>-</button>
                        <span className="mx-2">{item.quantity}</span>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => adjustQuantity(item.barcode, 1)}>+</button>
                      </div>
                    </td>
                    <td>
                      {item.manual && <span className="badge bg-warning text-dark"><i className="bi bi-pencil-square me-1"></i>Ingreso Manual</span>}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => removeItem(item.barcode)}>
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
            <button onClick={generatePDF} className="btn btn-danger me-2">
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
