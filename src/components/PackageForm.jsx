'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import Quagga from 'quagga'
import { jsPDF } from 'jspdf'

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

  // Función para generar PDF SIN usar jspdf-autotable
  const generatePDFSimple = () => {
    try {
      const doc = new jsPDF()

      // Título
      doc.setFontSize(18)
      doc.text('LISTA DE PRODUCTOS - PAQUETE', 105, 15, { align: 'center' })

      // Datos generales
      doc.setFontSize(12)
      doc.text(`ID del Paquete: ${pkg.id}`, 14, 25)
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 32)
      doc.text(`Total de items: ${totalItems}`, 14, 39)

      let y = 46
      if (responsible) {
        doc.text(`Responsable: ${responsible}`, 14, y)
        y += 7
      }
      if (laboratory) {
        doc.text(`Laboratorio: ${laboratory}`, 14, y)
        y += 7
      }
      if (isPsychotropic) {
        doc.text(`Tipo: Psicofármaco`, 14, y)
        y += 7
      }

      y += 10 // espacio antes tabla

      // Tabla
      const marginX = 14
      const rowHeight = 8
      const colWidths = [40, 80, 30, 30] // ancho columnas: código, producto, cantidad, observaciones
      const headers = ['Código', 'Producto', 'Cantidad', 'Observaciones']

      // Dibujar encabezado tabla
      doc.setFillColor(52, 73, 94) // azul oscuro
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      let x = marginX
      headers.forEach((header, i) => {
        doc.rect(x, y, colWidths[i], rowHeight, 'F') // fondo relleno
        doc.text(header, x + 2, y + 6)
        x += colWidths[i]
      })

      y += rowHeight
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)

      // Salto de página
      const pageHeight = doc.internal.pageSize.height
      const maxY = pageHeight - 20

      normalizedItems.forEach(item => {
        if (y + rowHeight > maxY) {
          doc.addPage()
          y = 20

          // Repetir encabezado
          doc.setFillColor(52, 73, 94)
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(11)
          let x2 = marginX
          headers.forEach((header, i) => {
            doc.rect(x2, y, colWidths[i], rowHeight, 'F')
            doc.text(header, x2 + 2, y + 6)
            x2 += colWidths[i]
          })
          y += rowHeight
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
        }

        x = marginX
        doc.text(item.barcode, x + 2, y + 6)
        x += colWidths[0]
        doc.text(item.name, x + 2, y + 6)
        x += colWidths[1]
        doc.text(String(item.quantity), x + 2, y + 6)
        x += colWidths[2]
        doc.text(item.manual ? 'Ingreso Manual' : '', x + 2, y + 6)

        y += rowHeight
      })

      doc.save(`lista_paquete_${pkg.id}.pdf`)
    } catch (error) {
      console.error('Error al generar PDF:', error)
      setMessage('Error al generar el PDF. Verifica la consola para más detalles.')
      setMessageType('danger')
      setTimeout(() => setMessage(''), 5000)
    }
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
                type="text"
                className="form-control"
                id="barcodeInput"
                ref={inputRef}
                value={scannedCode}
                onChange={handleScan}
                onKeyDown={handleScan}
                placeholder="Ingrese o escanee el código de barras"
              />
              <button className="btn btn-secondary mt-2" onClick={startBarcodeScanner}>
                Escanear con cámara
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleManualSubmit} className="mb-4">
            <h6>Agregar Producto Manualmente</h6>
            <div className="mb-3">
              <label className="form-label">Código de Barras</label>
              <input
                type="text"
                className="form-control"
                value={manualProduct.barcode}
                onChange={(e) => setManualProduct({ ...manualProduct, barcode: e.target.value })}
                required
                readOnly={manualProduct.barcode !== ''}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Nombre del Producto</label>
              <input
                type="text"
                className="form-control"
                value={manualProduct.name}
                onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary me-2">Agregar</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowManualForm(false)}>Cancelar</button>
          </form>
        )}

        <div className="table-responsive mb-4">
          <table className="table table-bordered align-middle">
            <thead className="table-primary">
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {normalizedItems.map(item => (
                <tr key={item.barcode}>
                  <td>{item.barcode}</td>
                  <td>{item.name}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <button
                        className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => adjustQuantity(item.barcode, -1)}
                        disabled={item.quantity <= 1}
                      >-</button>
                      <span>{item.quantity}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary ms-1"
                        onClick={() => adjustQuantity(item.barcode, 1)}
                      >+</button>
                    </div>
                  </td>
                  <td>{item.manual ? 'Ingreso Manual' : ''}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => removeItem(item.barcode)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={generatePDFSimple}>
            Exportar PDF
          </button>
          <button className="btn btn-outline-success" onClick={generateExcel}>
            Exportar Excel
          </button>
        </div>
      </div>
    </div>
  )
}
