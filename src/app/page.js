// src/app/page.js
import PackageManager from '@/components/PackageManager'
import productsData from '@/data/products.json'

export default function Home() {
  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h1 className="text-center mb-4">Sistema de Empaquetado de Productos</h1>
          <PackageManager products={productsData.products} />
        </div>
      </div>
    </div>
  )
}