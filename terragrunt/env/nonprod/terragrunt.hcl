include {
    path = find_in_parent_folders()
}

terraform {
    source = "github.com/chicagozer/rtdb//terraform?ref=master"
}


inputs = {
    namespace="nonprod"
}
