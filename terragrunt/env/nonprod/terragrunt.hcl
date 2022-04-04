include {
    path = find_in_parent_folders()
}

terraform {
#    source = "git::git@github.com:chicagozer/rtdb.git//terraform?ref=kaniko"
    source = "github.com/chicagozer/rtdb//terraform?ref=kaniko"
}


inputs = {
    namespace="nonprod"
}
