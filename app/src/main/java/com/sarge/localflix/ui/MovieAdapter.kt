package com.sarge.localflix.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sarge.localflix.data.Movie
import com.sarge.localflix.databinding.ItemMovieBinding

class MovieAdapter(
    private val onClick: (Movie) -> Unit
) : ListAdapter<Movie, MovieAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Movie>() {
            override fun areItemsTheSame(a: Movie, b: Movie) = a.path == b.path
            override fun areContentsTheSame(a: Movie, b: Movie) = a == b
        }
    }

    inner class VH(private val binding: ItemMovieBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(movie: Movie) {
            binding.movieName.text   = movie.name
            binding.movieMeta.text   = "${movie.ext}  ·  ${movie.sizeStr}"
            binding.movieFolder.text = if (movie.folder.isNotEmpty()) "📁  ${movie.folder}" else ""
            binding.root.setOnClickListener { onClick(movie) }
            binding.root.setOnFocusChangeListener { _, focused ->
                // Scale card slightly when focused via D-pad
                binding.root.animate()
                    .scaleX(if (focused) 1.08f else 1.0f)
                    .scaleY(if (focused) 1.08f else 1.0f)
                    .setDuration(120)
                    .start()
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemMovieBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(getItem(position))
    }
}
