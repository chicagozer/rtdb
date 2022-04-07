provider "helm" {
  kubernetes {
#     config_path = "~/.kube/config"
    }
}

resource "helm_release" "rtdb" {
  namespace = var.namespace
  name       = "rtdb"
  repository = "https://chicagozer.github.io/helm-chart/"
  chart      = "rtdb"
  
  set {
    name  = "image.tag"
    value = "${lookup(var.app_version,"rtdb")}"
  }
}
