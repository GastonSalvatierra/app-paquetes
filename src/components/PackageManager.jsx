// src/components/PackageManager.js
'use client'

import { useState } from 'react'
import PackageForm from './PackageForm'

export default function PackageManager({ products }) {
  const [packages, setPackages] = useState([])
  const [activePackageId, setActivePackageId] = useState(null)

  const createNewPackage = () => {
    const newId = `PKG-${Date.now()}`
    const newPackage = {
      id: newId,
      items: [],
      createdAt: new Date().toISOString()
    }
    setPackages([...packages, newPackage])
    setActivePackageId(newId)
  }

  const updatePackage = (packageId, updatedItems) => {
    setPackages(prev => prev.map(pkg => 
      pkg.id === packageId ? {...pkg, items: updatedItems} : pkg
    ))
  }

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">Gestión de Paquetes</h5>
          </div>
          <div className="card-body">
            <button onClick={createNewPackage} className="btn btn-success w-100 mb-3">
              <i className="bi bi-plus-circle me-2"></i>Crear Nuevo Paquete
            </button>
            
            <div className="list-group">
              {packages.map(pkg => (
                <button
                  key={pkg.id} 
                  type="button"
                  className={`list-group-item list-group-item-action ${pkg.id === activePackageId ? 'active' : ''}`}
                  onClick={() => setActivePackageId(pkg.id)}
                >
                  <div className="d-flex w-100 justify-content-between">
                    <h6 className="mb-1">Paquete: {pkg.id.substring(0, 8)}...</h6>
                    <small>{pkg.items.length} items</small>
                  </div>
                  <small>{new Date(pkg.createdAt).toLocaleTimeString()}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-8">
        {activePackageId ? (
          <PackageForm 
            package={packages.find(p => p.id === activePackageId)} 
            products={products}
            onUpdate={updatePackage}
          />
        ) : (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="bi bi-box-seam display-1 text-muted"></i>
              <h3 className="mt-3">Selecciona o crea un paquete</h3>
              <p className="text-muted">Para comenzar a escanear productos, crea un nuevo paquete o selecciona uno existente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}